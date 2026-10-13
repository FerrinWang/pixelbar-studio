// Trusted local provider example. Enable explicitly before using.
export const id = 'example';
export const enabled = false;
export async function collect({now}) {
  // Replace with a read-only local service request. Do not return credentials.
  return {label:'LOCAL',value:Math.floor(now/1000)%100};
}
