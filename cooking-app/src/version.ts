// Hardcoded OTA bundle label, surfaced on the Landing screen so we can confirm
// on-device which JS bundle the phone actually picked up after an `eas update`.
//
// BUMP THIS BEFORE EVERY `eas update` — otherwise you can't tell whether the
// OTA landed. Format: <app version>+ota.<n>, increment <n> each OTA push.
export const OTA_VERSION = '1.0.0+ota.2';
