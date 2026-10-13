import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    var process: Process?
    var item: NSStatusItem?
    var log: FileHandle?
    var attempts = 0
    let url = URL(string: "http://127.0.0.1:4173/")!
    func applicationDidFinishLaunching(_ notification: Notification) {
        let resources = Bundle.main.resourceURL!
        let support = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/PixelBar Studio")
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        let logURL = support.appendingPathComponent("companion.log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        log = try? FileHandle(forWritingTo: logURL)
        let task = Process()
        task.executableURL = resources.appendingPathComponent("runtime/node")
        task.arguments = [resources.appendingPathComponent("studio/server/server.js").path]
        task.currentDirectoryURL = resources.appendingPathComponent("studio")
        var environment = ProcessInfo.processInfo.environment
        environment["PIXELBAR_ENGINE"] = resources.appendingPathComponent("pixelbar-engine").path
        environment["PATH"] = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:" + (environment["PATH"] ?? "")
        task.environment = environment
        task.standardOutput = log ?? FileHandle.nullDevice
        task.standardError = log ?? FileHandle.nullDevice
        process = task
        do { try task.run() } catch { showError("无法启动本地服务。请查看伴侣日志。"); return }
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item?.button?.title = "▦ PB"
        item?.button?.toolTip = "PixelBar Studio · 本地像素屏编辑器"
        let menu = NSMenu()
        for (name, action) in [("打开编辑器", #selector(openEditor)), ("打开插件与数据目录", #selector(openExtensions)), ("查看运行日志", #selector(openLog)), ("退出并停止后台更新", #selector(quit))] {
            let entry = NSMenuItem(title: name, action: action, keyEquivalent: "")
            entry.target = self
            menu.addItem(entry)
        }
        item?.menu = menu
        checkReady()
    }
    func checkReady() {
        attempts += 1
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if let response = response as? HTTPURLResponse, response.statusCode == 200 { self.openEditor() }
                else if self.attempts < 30 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.checkReady() } }
                else { self.showError("本地编辑器未能启动。端口 4173 可能已被占用，请查看日志。") }
            }
        }.resume()
    }
    @objc func openEditor() { NSWorkspace.shared.open(url) }
    @objc func openExtensions() {
        let root = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/PixelBar Studio/extensions")
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        NSWorkspace.shared.open(root)
    }
    @objc func openLog() { NSWorkspace.shared.open(FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/PixelBar Studio/companion.log")) }
    @objc func quit() { NSApp.terminate(nil) }
    func showError(_ message: String) { let alert = NSAlert(); alert.messageText = "PixelBar Studio"; alert.informativeText = message; alert.runModal() }
    func applicationWillTerminate(_ notification: Notification) { if process?.isRunning == true { process?.terminate() }; try? log?.close() }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
