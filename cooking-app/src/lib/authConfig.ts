// Google OAuth client IDs from Google Cloud Console (Florian's setup).
// These are PUBLIC identifiers (they ship in the app bundle), not secrets — safe
// to commit. Fill both in from the values Florian sends back, then rebuild.
//
// Also update app.json's @react-native-google-signin plugin `iosUrlScheme` to the
// REVERSED iOS client id: for an iOS client id "1234-abcd.apps.googleusercontent.com",
// the reversed form is "com.googleusercontent.apps.1234-abcd".
//
// TODO(Florian's IDs): replace the two placeholders below before the build.
export const GOOGLE_WEB_CLIENT_ID = 'REPLACE_WITH_GOOGLE_WEB_CLIENT_ID';
export const GOOGLE_IOS_CLIENT_ID = 'REPLACE_WITH_GOOGLE_IOS_CLIENT_ID';
