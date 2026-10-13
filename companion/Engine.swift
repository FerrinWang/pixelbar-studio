import Foundation
import IOKit.hid
import Darwin

// Standalone macOS CLI. Frame input is 256x32: four 256-byte pages,
// page-major, with each byte's least significant bit at the top of its 8-pixel column.
// USB legacy framing splits those 1024 bytes into eight consecutive 128-byte segments.
struct EngineError: Error {
    let code: String
    let message: String
    var details: [String: Any]? = nil
}
func fail(_ code: String, _ message: String) -> EngineError { EngineError(code: code, message: message) }
func color(_ text: String) throws -> [UInt8] {
    guard text.count == 7, text.first == "#", let value = UInt32(text.dropFirst(), radix: 16) else {
        throw fail("invalid_color", "Color must be #RRGGBB.")
    }
    return [UInt8((value >> 16) & 255), UInt8((value >> 8) & 255), UInt8(value & 255)]
}
func emit(_ object: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
       let line = String(data: data, encoding: .utf8) { print(line) }
}

final class RPC {
    let process = Process()
    let input = Pipe(), output = Pipe()
    var buffer = Data()
    init() throws {
        let fm = FileManager.default
        let paths = (ProcessInfo.processInfo.environment["PATH"] ?? "").split(separator: ":").map { String($0) + "/codex" }
        let candidates = paths + [
            "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
            "/Applications/Codex.app/Contents/Resources/codex",
            "/Applications/Codex.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
            fm.homeDirectoryForCurrentUser.appendingPathComponent(".codex/bin/codex").path
        ]
        guard let executable = candidates.first(where: { fm.isExecutableFile(atPath: $0) }) else {
            throw fail("codex_not_found", "No local Codex executable found.")
        }
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = ["app-server"]
        process.standardInput = input
        process.standardOutput = output
        // Never forward server diagnostics, account details, or credentials.
        process.standardError = FileHandle.nullDevice
        do { try process.run() } catch { throw fail("codex_start_failed", "Unable to start local Codex app-server.") }
        let fd = output.fileHandleForReading.fileDescriptor
        _ = fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK)
    }
    func close() {
        try? input.fileHandleForWriting.close()
        if process.isRunning {
            process.terminate()
            let end = Date().addingTimeInterval(0.25)
            while process.isRunning && Date() < end { usleep(5_000) }
            if process.isRunning { kill(process.processIdentifier, SIGKILL) }
        }
        try? output.fileHandleForReading.close()
    }
    func send(_ object: [String: Any]) throws {
        var data = try JSONSerialization.data(withJSONObject: object)
        data.append(10)
        do { try input.fileHandleForWriting.write(contentsOf: data) }
        catch { throw fail("codex_io_failed", "Codex app-server input closed.") }
    }
    func response(_ id: Int, until deadline: Date) throws -> [String: Any] {
        while Date() < deadline {
            while let newline = buffer.firstIndex(of: 10) {
                let line = buffer.prefix(upTo: newline)
                buffer.removeSubrange(...newline)
                guard let obj = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any],
                      (obj["id"] as? NSNumber)?.intValue == id else { continue }
                if obj["error"] != nil { throw fail("quota_rejected", "Codex app-server rejected the quota request; check local sign-in.") }
                guard let result = obj["result"] as? [String: Any] else { throw fail("quota_invalid", "Codex returned an invalid response.") }
                return result
            }
            var pfd = pollfd(fd: output.fileHandleForReading.fileDescriptor, events: Int16(POLLIN), revents: 0)
            let remaining = max(1, min(50, Int(deadline.timeIntervalSinceNow * 1000)))
            if poll(&pfd, 1, Int32(remaining)) > 0 {
                var bytes = [UInt8](repeating: 0, count: 8192)
                let n = read(pfd.fd, &bytes, bytes.count)
                if n > 0 { buffer.append(contentsOf: bytes.prefix(n)) }
                else if n == 0 { throw fail("codex_exited", "Codex app-server exited before returning quota.") }
                if buffer.count > 1_048_576 { throw fail("quota_invalid", "Codex response exceeded the size limit.") }
            }
        }
        throw fail("quota_timeout", id == 1 ? "Codex initialization timed out." : "Codex quota request timed out.")
    }
}

func quota() throws -> [String: Any] {
    let rpc = try RPC()
    defer { rpc.close() }
    let deadline = Date().addingTimeInterval(12)
    try rpc.send(["id": 1, "method": "initialize", "params": ["clientInfo": ["name": "pixelbar_engine", "title": "PixelBar", "version": "1.0.0"], "capabilities": NSNull()]])
    _ = try rpc.response(1, until: deadline)
    try rpc.send(["method": "initialized"])
    try rpc.send(["id": 2, "method": "account/rateLimits/read", "params": [:] as [String: Any]])
    let result = try rpc.response(2, until: deadline)
    let byID = result["rateLimitsByLimitId"] as? [String: Any]
    let fallback = result["rateLimits"] as? [String: Any]
    let selected: [String: Any]?
    if let codex = byID?["codex"] as? [String: Any] { selected = codex }
    else if let fallback, fallback["limitId"] == nil || fallback["limitId"] is NSNull || fallback["limitId"] as? String == "codex" { selected = fallback }
    else { selected = nil }
    guard let limits = selected else { throw fail("quota_unavailable", "Codex did not provide a Codex quota snapshot.") }
    func window(_ name: String) throws -> Any {
        guard let value = limits[name], !(value is NSNull) else { return NSNull() }
        guard let w = value as? [String: Any], let percent = w["usedPercent"] as? NSNumber,
              CFGetTypeID(percent) != CFBooleanGetTypeID(), percent.doubleValue.isFinite,
              percent.doubleValue >= 0, percent.doubleValue <= 100 else {
            throw fail("quota_invalid", "Codex returned an invalid quota window.")
        }
        var normalized: [String: Any] = ["usedPercent": percent]
        for key in ["windowDurationMins", "resetsAt"] {
            if let n = w[key] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite, n.doubleValue >= 0 {
                normalized[key] = n
            } else if w[key] == nil || w[key] is NSNull { normalized[key] = NSNull() }
            else { throw fail("quota_invalid", "Codex returned invalid quota timing.") }
        }
        return normalized
    }
    let primary = try window("primary"), secondary = try window("secondary")
    return ["primary": primary, "secondary": secondary, "updatedAt": ISO8601DateFormatter().string(from: Date()), "status": "live"]
}

func hidError(_ result: IOReturn) -> EngineError {
    if result == kIOReturnExclusiveAccess || result == kIOReturnBusy { return fail("device_busy", "PixelBar is in use by another application.") }
    if result == kIOReturnNotPermitted || result == kIOReturnNotPrivileged { return fail("device_permission", "macOS denied HID access to PixelBar.") }
    return fail("device_io", "PixelBar HID operation failed (\(String(format: "0x%08x", UInt32(bitPattern: result)))).")
}

final class HID {
    let manager: IOHIDManager
    var devices: [IOHIDDevice] = []
    var device: IOHIDDevice?
    let report = UnsafeMutablePointer<UInt8>.allocate(capacity: 128)
    var responses: [(UInt8, [UInt8])] = []
    init() throws {
        manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
        IOHIDManagerSetDeviceMatching(manager, [
            kIOHIDVendorIDKey: 0x2D99, kIOHIDProductIDKey: 0xA160,
            kIOHIDPrimaryUsagePageKey: 0xFF13
        ] as CFDictionary)
        let result = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        guard result == kIOReturnSuccess else { throw hidError(result) }
        devices = (IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice> ?? []).filter { d in
            func number(_ key: String) -> Int { (IOHIDDeviceGetProperty(d, key as CFString) as? NSNumber)?.intValue ?? -1 }
            return number(kIOHIDVendorIDKey) == 0x2D99 && number(kIOHIDProductIDKey) == 0xA160 &&
                number(kIOHIDPrimaryUsagePageKey) == 0xFF13
        }
    }
    deinit {
        if let d = device {
            IOHIDDeviceUnscheduleFromRunLoop(d, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
            IOHIDDeviceClose(d, IOOptionBits(kIOHIDOptionsTypeNone))
        }
        IOHIDManagerClose(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        report.deallocate()
    }
    func open() throws {
        if device != nil { return }
        guard devices.count == 1, let d = devices.first else {
            throw fail(devices.isEmpty ? "device_disconnected" : "device_ambiguous", devices.isEmpty ? "PixelBar is not connected." : "Connect exactly one PixelBar.")
        }
        let result = IOHIDDeviceOpen(d, IOOptionBits(kIOHIDOptionsTypeNone))
        guard result == kIOReturnSuccess else { throw hidError(result) }
        device = d
        IOHIDDeviceRegisterInputReportCallback(d, report, 128, { context, result, _, _, _, bytes, count in
            guard let context, result == kIOReturnSuccess else { return }
            Unmanaged<HID>.fromOpaque(context).takeUnretainedValue().receive(Array(UnsafeBufferPointer(start: bytes, count: count)))
        }, Unmanaged.passUnretained(self).toOpaque())
        IOHIDDeviceScheduleWithRunLoop(d, CFRunLoopGetCurrent(), CFRunLoopMode.defaultMode.rawValue)
    }
    func receive(_ bytes: [UInt8]) {
        // Some HID stacks include the report ID; others strip it.
        let b = bytes.first == 0x2F ? Array(bytes.dropFirst()) : bytes
        guard b.count >= 6, b[0] == 0xBB, b[1] == 0xEC || b[1] == 0xED else { return }
        let length = Int(b[3]) * 256 + Int(b[4])
        guard length <= 121, b.count >= 6 + length else { return }
        guard b.prefix(5 + length).reduce(UInt8(0), { $0 &+ $1 }) == b[5 + length] else { return }
        if responses.count < 128 { responses.append((b[2], Array(b[5..<(5 + length)]))) }
    }
    func send(_ command: UInt8, _ payload: [UInt8], typeOverride: UInt8? = nil) throws {
        guard let d = device, payload.count <= 57 else { throw fail("protocol_invalid", "Invalid HID payload size.") }
        // Verified tester uses EC for upload and ED for scene control/readback.
        let type: UInt8 = typeOverride ?? (command == 0x17 ? 0xEC : 0xED)
        var b: [UInt8] = [0x2E, 0xAA, type, command, UInt8(payload.count >> 8), UInt8(payload.count & 255)] + payload
        b.append(b.dropFirst().reduce(UInt8(0), { $0 &+ $1 }))
        b += Array(repeating: 0, count: 64 - b.count)
        let result = b.withUnsafeBufferPointer { IOHIDDeviceSetReport(d, kIOHIDReportTypeOutput, 0x2E, $0.baseAddress!, 64) }
        guard result == kIOReturnSuccess else { throw hidError(result) }
    }
    func wait(_ command: UInt8, timeout: TimeInterval = 2) throws -> [UInt8] {
        let end = Date().addingTimeInterval(timeout)
        while Date() < end {
            if let i = responses.firstIndex(where: { $0.0 == command }) { return responses.remove(at: i).1 }
            CFRunLoopRunInMode(CFRunLoopMode.defaultMode, min(0.01, max(0.001, end.timeIntervalSinceNow)), true)
        }
        throw fail("device_timeout", "PixelBar response timed out.")
    }
    func progress(_ duration: TimeInterval = 0.02) {
        let end = Date().addingTimeInterval(duration)
        while Date() < end {
            CFRunLoopRunInMode(CFRunLoopMode.defaultMode, min(0.005, max(0.001, end.timeIntervalSinceNow)), true)
        }
    }
    func readScreen(timeout: TimeInterval = 2) throws -> [UInt8] {
        progress(min(0.005, timeout / 4))
        responses.removeAll(where: { $0.0 == 0xEE })
        try send(0xEE, [])
        let values = try wait(0xEE, timeout: timeout)
        guard values.count >= 9, values.count <= 57 else {
            throw fail("screen_invalid", "PixelBar returned an unsupported screen settings payload.")
        }
        return values
    }
    func screenDTO(_ values: [UInt8]) -> [String: Any] {
        ["raw": values.map(Int.init), "rgb": Array(values[1...3]).map(Int.init),
         "color": String(format: "#%02X%02X%02X", values[1], values[2], values[3]),
         "scene": Int(values[6]), "template": Int(values[7])]
    }
    func writeScreen(_ values: [UInt8]) throws {
        // EE starts with read action 0 and may include trailing metadata.
        // EF takes write action 1 plus the eight screen setting bytes only.
        try send(0xEF, [1] + Array(values[1...8]))
        progress()
    }
    func screenMatches(_ actual: [UInt8], _ expected: [UInt8]) -> Bool {
        actual[1...8].elementsEqual(expected[1...8])
    }
    func verifyScreen(_ expected: [UInt8], code: String) throws -> [UInt8] {
        let deadline = Date().addingTimeInterval(1)
        while Date() < deadline {
            do {
                let values = try readScreen(timeout: min(0.2, max(0.001, deadline.timeIntervalSinceNow)))
                if screenMatches(values, expected) { return values }
            } catch let error as EngineError where error.code == "device_timeout" { }
        }
        throw fail(code, "PixelBar did not confirm the requested screen settings within one second.")
    }
    func readLighting(timeout: TimeInterval = 2, collection: TimeInterval = 0.2) throws -> [[UInt8]] {
        progress(min(0.005, timeout / 4))
        responses.removeAll(where: { $0.0 == 0x6A })
        try send(0x6A, [])
        var arrays = [try wait(0x6A, timeout: timeout)]
        let end = Date().addingTimeInterval(collection)
        while Date() < end {
            CFRunLoopRunInMode(CFRunLoopMode.defaultMode, min(0.01, max(0.001, end.timeIntervalSinceNow)), true)
            while let i = responses.firstIndex(where: { $0.0 == 0x6A }) { arrays.append(responses.remove(at: i).1) }
        }
        return arrays
    }
    func settingsDTO(_ screen: [UInt8], _ arrays: [[UInt8]], status: String) throws -> [String: Any] {
        let parsed: [[String: Any]] = try arrays.map { values in
            guard values.count >= 2, (values.count - 2) % 6 == 0 else {
                throw fail("lighting_invalid", "PixelBar returned an unsupported lighting array payload.")
            }
            var groups: [[String: Any]] = []
            for i in stride(from: 2, to: values.count, by: 6) {
                groups.append(["index": Int(values[i]), "rgb": Array(values[(i + 1)...(i + 3)]).map(Int.init),
                               "brightness": Int(values[i + 4]), "speed": Int(values[i + 5])])
            }
            return ["array": Int(values[0]), "currentIndex": Int(values[1]), "groups": groups]
        }
        return ["status": status, "screen": screenDTO(screen),
                "lighting": ["rawArrays": arrays.map { $0.map(Int.init) }, "arrays": parsed]]
    }
    func settings() throws -> [String: Any] {
        try open()
        return try settingsDTO(readScreen(), readLighting(), status: "read")
    }
    func lighting(_ rgb: [UInt8], brightness: Int, enabled: Bool, effect: String, requestedSpeed: Int? = nil) throws -> [String: Any] {
        try open()
        let before = try readLighting()
        guard let array = before.first(where: { $0.first == 32 }), array.count >= 2,
              (array.count - 2) % 6 == 0 else {
            throw fail("lighting_invalid", "PixelBar did not provide lighting array 32.")
        }
        let modes: [String: UInt8] = ["breathing": 1, "tide": 2, "solid": 3, "rainbow": 4, "shadow": 5, "dynamic": 6]
        let index = modes[effect] ?? (array[1] == 7 ? 3 : array[1])
        guard (1...6).contains(index) else { throw fail("lighting_effect", "PixelBar returned an unsupported current effect.") }
        guard requestedSpeed == nil || index == 1 || index == 2 else { throw fail("invalid_speed", "Speed applies only to breathing and tide.") }
        guard let group = stride(from: 2, to: array.count, by: 6).first(where: { array[$0] == index }),
              stride(from: 2, to: array.count, by: 6).contains(where: { array[$0] == 7 }) else {
            throw fail("lighting_invalid", "PixelBar did not provide the effect and power groups.")
        }
        let expectedRGB = index == 1 || index == 3 ? rgb : Array(array[(group + 1)...(group + 3)])
        let speed = requestedSpeed.map(UInt8.init) ?? array[group + 5]
        try send(0x6B, [32, index] + expectedRGB + [UInt8(brightness), speed])
        progress()
        try send(0x6B, [32, 7, 0, 0, enabled ? 1 : 0, 255, 255])
        progress()
        func matches(_ after: [[UInt8]]) -> Bool {
            guard let verified = after.first(where: { $0.first == 32 }), verified.count >= 2,
              (verified.count - 2) % 6 == 0, verified[1] == (enabled ? index : 7),
              let current = stride(from: 2, to: verified.count, by: 6).first(where: { verified[$0] == index }),
              let power = stride(from: 2, to: verified.count, by: 6).first(where: { verified[$0] == 7 }),
              Array(verified[(current + 1)...(current + 3)]) == expectedRGB,
              verified[current + 4] == UInt8(brightness), verified[current + 5] == speed,
              verified[power + 3] == (enabled ? 1 : 0) else {
                return false
            }
            return true
        }
        let deadline = Date().addingTimeInterval(1)
        while Date() < deadline {
            do {
                let remaining = max(0.001, deadline.timeIntervalSinceNow)
                // Bound both the first response wait and multi-array collection.
                let after = try readLighting(timeout: min(0.15, remaining / 2), collection: min(0.2, remaining / 2))
                if matches(after) { return try settingsDTO(readScreen(), after, status: "updated") }
            } catch let error as EngineError where error.code == "device_timeout" { }
        }
        throw fail("lighting_verify_failed", "PixelBar did not confirm the requested effect, RGB, brightness, speed and power within one second.")
    }
    func setScreen(_ rgb: [UInt8]) throws -> [String: Any] {
        try open()
        try send(0xEF, [3] + rgb)
        progress()
        let deadline = Date().addingTimeInterval(1)
        while Date() < deadline {
            do {
                let verified = try readScreen(timeout: min(0.2, max(0.001, deadline.timeIntervalSinceNow)))
                if Array(verified[1...3]) == rgb { return ["status": "updated", "screen": screenDTO(verified)] }
            } catch let error as EngineError where error.code == "device_timeout" { }
        }
        throw fail("screen_verify_failed", "PixelBar did not confirm the requested screen RGB within one second.")
    }
    func silentPush(_ raw: Data, rgb: [UInt8]? = nil, animationDelay: Int? = nil, notice: String = "屏幕更新中") throws -> [String: Any] {
        try open()
        func readBeep() throws -> [UInt8] {
            try send(0x86, [], typeOverride: 0xEC)
            return try wait(0x86)
        }
        let original = try readBeep()
        guard original.count == 3, original[0] == 14, original[1] <= 1, original[2] <= 1 else {
            throw fail("unsupported_beep", "无法确认消息提示音设置，已停止静默上传，未修改设备。")
        }
        // Keep this short: block padding triggers firmware scrolling and can disturb
        // the transition back to the image. The native text API has no alignment field.
        let text = Array(notice.utf8)
        try send(0xE7, [9], typeOverride: 0xEC)
        let capacity = try wait(0xE7)
        guard capacity.count >= 4, capacity[0] == 9, capacity[2] > 0, capacity[2] <= 55 else {
            throw fail("unsupported_text", "无法确认新闻文字容量，已停止静默上传。")
        }
        let maxTextBytes = min(Int(capacity[1]) * 3, 255)
        guard text.count <= maxTextBytes else { throw fail("notice_too_large", "提示文字为\(text.count)字节，设备返回容量上限为\(maxTextBytes)字节；未截断、未上传。") }
        var result: [String: Any]? = nil
        var uploadError: Error? = nil
        do {
            if original[2] != 0 { try send(0x87, [14, 2, 0], typeOverride: 0xEC); progress(0.2) }
            guard try readBeep() == [14, original[1], 0] else { throw fail("mute_verify_failed", "消息提示音关闭未确认，已停止上传。") }
            let packetSize = Int(capacity[2])
            for offset in stride(from: 0, to: text.count, by: packetSize) {
                try send(0xE8, [9, UInt8(text.count)] + Array(text[offset..<min(text.count, offset + packetSize)]), typeOverride: 0xEC)
                progress(0.02)
            }
            progress(1.5)
            result = try push(raw, rgb: rgb, animationDelay: animationDelay)
        } catch { uploadError = error }
        // Restore even after a failed mute verification, text send, or image transfer.
        do {
            try send(0x87, [14, 2, original[2]], typeOverride: 0xEC)
            progress(0.2)
            guard try readBeep() == original else { throw fail("restore_verify_failed", "消息提示音原设置恢复未确认，请检查设备。") }
        } catch {
            throw EngineError(code: "restore_verify_failed", message: "消息提示音原设置恢复未确认，请检查设备。", details: ["originalBeep": original.map(Int.init), "uploadError": uploadError.map { String(describing: $0) } ?? "none"])
        }
        if let uploadError { throw uploadError }
        guard var result else { throw fail("upload_failed", "画布未上传。") }
        result["silentUpdate"] = true
        result["messageBeepRestored"] = true
        result["centering"] = "firmware-default"
        return result
    }
    func push(_ raw: Data, rgb: [UInt8]? = nil, animationDelay: Int? = nil) throws -> [String: Any] {
        try open()
        var screen = try readScreen()
        if let rgb { screen.replaceSubrange(1...3, with: rgb) }
        var legacy: [UInt8] = []
        // Header index identifies a legacy segment, not a framebuffer page.
        // Segment 2*p is page p's left half; segment 2*p+1 is its right half.
        let animated = animationDelay != nil
        let group: UInt8 = animated ? 7 : 3
        let template: UInt8 = animated ? 15 : 4
        for segment in 0..<(raw.count / 128) {
            let delay = animationDelay ?? 65535
            legacy += [group, UInt8(segment >> 8), UInt8(segment & 255), UInt8(delay >> 8), UInt8(delay & 255)]
            legacy += raw[(segment * 128)..<((segment + 1) * 128)]
        }
        let size = legacy.count
        try send(0x17, [0, 0, UInt8((size >> 24) & 255), UInt8((size >> 16) & 255), UInt8((size >> 8) & 255), UInt8(size & 255)])
        let ready = try wait(0x17)
        guard ready.count == 4, ready[0] == 0, ready[1] == 1 else { throw fail("upload_rejected", "PixelBar rejected upload notification.") }
        let chunkSize = Int(ready[2]) * 256 + Int(ready[3])
        guard chunkSize > 0, chunkSize <= 53 else { throw fail("protocol_invalid", "PixelBar requested an unsupported chunk size.") }
        let chunks = (size + chunkSize - 1) / chunkSize
        func reportProgress(_ completed: Int, phase: String = "uploading") {
            let value: [String: Any] = ["event": "transfer-progress", "completedBytes": completed, "totalBytes": size, "frames": raw.count / 1024, "phase": phase]
            if let data = try? JSONSerialization.data(withJSONObject: value) { FileHandle.standardError.write(data); FileHandle.standardError.write(Data([10])) }
        }
        reportProgress(0)
        for index in 0..<chunks {
            let start = index * chunkSize
            try send(0x17, [0, 2, UInt8(index >> 8), UInt8(index & 255)] + Array(legacy[start..<min(size, start + chunkSize)]))
            let ack = try wait(0x17)
            if ack == [0, 5] && index != chunks - 1 {
                let sentBytes = min(size, start + chunkSize)
                throw EngineError(code: "upload_truncated", message: "Device ended the transfer early; the complete animation was not accepted.", details: ["sentBytes": sentBytes, "totalBytes": size, "requestedFrames": raw.count / 1024, "approximateFramesAtEnd": sentBytes / 1064, "sentIndex": index])
            }
            if index % 64 == 63 || index == chunks - 1 { reportProgress(min(size, start + chunkSize)) }
            if index == chunks - 1 && ack == [0, 5] { break }
            guard ack.count == 4, ack[0] == 0, ack[1] == 3, Int(ack[2]) * 256 + Int(ack[3]) == index else {
                let actualIndex: Any = ack.count == 4 && ack[0] == 0 && ack[1] == 3
                    ? Int(ack[2]) * 256 + Int(ack[3]) : NSNull()
                throw EngineError(code: "upload_rejected", message: "PixelBar returned an invalid chunk acknowledgement.",
                                  details: ["sentIndex": index, "expectedAckIndex": index,
                                            "actualIndex": actualIndex, "actualAck": ack.map(Int.init),
                                            "chunkSize": chunkSize, "totalChunks": chunks])
            }
            if index == chunks - 1 {
                try send(0x17, [0, 4])
                guard try wait(0x17) == [0, 5] else { throw fail("upload_rejected", "PixelBar did not complete the upload.") }
            }
        }
        screen[5] = 1
        reportProgress(size, phase: "verifying")
        screen[6] = group
        screen[7] = template
        if let rgb {
            try send(0xEF, [3] + rgb)
            progress()
        }
        try writeScreen(screen)
        let scene = try verifyScreen(screen, code: "scene_verify_failed")
        reportProgress(size, phase: "done")
        return ["status": "pushed", "frameBytes": raw.count, "transferBytes": size, "scene": Int(group), "template": Int(template), "frames": raw.count / 1024, "experimentalAnimation": animated, "screen": screenDTO(scene)]
    }
}

do {
    var args = Array(CommandLine.arguments.dropFirst())
    var notice = "屏幕更新中"
    if args.count >= 2, args[args.count - 2] == "--notice" {
        notice = args.removeLast()
        args.removeLast()
        guard !notice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, notice.utf8.count <= 255,
              !notice.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else {
            throw fail("invalid_notice", "更新提示需要单行文字，最多255字节，不会自动截断。")
        }
    }
    switch args.first {
    case "quota" where args.count == 1: emit(try quota())
    case "status" where args.count == 1:
        let hid = try HID()
        var busy = false
        for d in hid.devices {
            let result = IOHIDDeviceOpen(d, IOOptionBits(kIOHIDOptionsTypeNone))
            if result == kIOReturnSuccess { IOHIDDeviceClose(d, IOOptionBits(kIOHIDOptionsTypeNone)) }
            else if result == kIOReturnExclusiveAccess || result == kIOReturnBusy { busy = true }
            else { throw hidError(result) }
        }
        emit(["connected": !hid.devices.isEmpty, "busy": busy])
    case "settings" where args.count == 1: emit(try HID().settings())
    case "screen" where args.count == 2:
        let rgb = try color(args[1])
        emit(try HID().setScreen(rgb))
    case "lighting" where (4...6).contains(args.count):
        let rgb = try color(args[1])
        guard let brightness = Int(args[2]), (10...100).contains(brightness), brightness % 10 == 0 else {
            throw fail("invalid_brightness", "Brightness must be 10 through 100 in steps of 10.")
        }
        guard args[3] == "true" || args[3] == "false" else { throw fail("invalid_enabled", "Enabled must be true or false.") }
        let effect = args.count >= 5 ? args[4] : "current"
        guard ["solid", "breathing", "tide", "rainbow", "shadow", "dynamic", "current"].contains(effect) else { throw fail("invalid_effect", "Unknown lighting effect.") }
        var speed: Int? = nil
        if args.count == 6 {
            guard let value = Int(args[5]), (1...10).contains(value) else { throw fail("invalid_speed", "Speed must be 1 through 10.") }
            speed = value
        }
        emit(try HID().lighting(rgb, brightness: brightness, enabled: args[3] == "true", effect: effect, requestedSpeed: speed))
    case let command where ["animation", "animation-probe"].contains(command) && args.count == 3:
        guard args[1].hasPrefix("/"), let delay = Int(args[2]), (100...60000).contains(delay) else { throw fail("invalid_animation", "Absolute frame file and delay 100–60000 required.") }
        let url = URL(fileURLWithPath: args[1])
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path), attrs[.type] as? FileAttributeType == .typeRegular,
              let size = (attrs[.size] as? NSNumber)?.intValue, size >= 2048, size <= (command == "animation-probe" ? 262144 : 61440), size % 1024 == 0,
              let data = try? Data(contentsOf: url), data.count == size else { throw fail("invalid_animation", "Animation limit is 60 frames; development probes allow up to 256. Larger files were truncated by this device.") }
        emit(try HID().silentPush(data, animationDelay: delay, notice: notice))
    case "push" where args.count == 2 || args.count == 3:
        let rgb = args.count == 3 ? try color(args[2]) : nil
        guard args[1].hasPrefix("/") else { throw fail("invalid_path", "Frame path must be absolute.") }
        let url = URL(fileURLWithPath: args[1])
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
              attrs[.type] as? FileAttributeType == .typeRegular,
              (attrs[.size] as? NSNumber)?.intValue == 1024 else { throw fail("invalid_frame", "Frame must be a readable regular file containing exactly 1024 bytes.") }
        guard let data = try? Data(contentsOf: url), data.count == 1024 else { throw fail("invalid_frame", "Unable to read the 1024-byte frame.") }
        emit(try HID().silentPush(data, rgb: rgb, notice: notice))
    default: throw fail("usage", "Usage: engine quota | status | settings | screen '#RRGGBB' | push /absolute/path/frame.bin ['#RRGGBB'] | lighting '#RRGGBB' brightness true|false [solid|breathing|tide|rainbow|shadow|dynamic|current] [speed]")
    }
} catch let error as EngineError {
    var dto: [String: Any] = ["code": error.code, "message": error.message]
    if let details = error.details { dto["details"] = details }
    emit(["status": "error", "error": dto])
    exit(1)
} catch {
    emit(["status": "error", "error": ["code": "engine_failed", "message": "Engine operation failed."]])
    exit(1)
}
