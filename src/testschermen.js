/**
 * Testschermen in een test-APK (21-11-2026).
 *
 * Alleen aan als de bundel is gebouwd met EXPO_PUBLIC_TESTSCHERMEN=1: de
 * workflow android-gradle.yml zet dat bij `wat=apk` met `testschermen=true`,
 * nooit bij een AAB voor Play. Metro vervangt process.env.EXPO_PUBLIC_* bij het
 * bundelen door de letterlijke waarde, dus in een gewone build staat hier
 * gewoon `false` en valt het scherm eruit.
 *
 * Waarvoor: het scrollen en tikken in de ingelogde schermen nalopen op de
 * emulator op de Mac mini, zonder in te loggen (zie GebarenTestScreen).
 */
export const TESTSCHERMEN = process.env.EXPO_PUBLIC_TESTSCHERMEN === '1';
