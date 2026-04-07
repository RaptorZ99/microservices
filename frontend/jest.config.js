/** @type {import('jest').Config} */
const config = {
  // ts-jest permet d'exécuter les fichiers TypeScript directement
  preset: 'ts-jest',
  testEnvironment: 'node',
  // On cherche les tests dans tests/ uniquement
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'junit.xml' }],
  ],
};

module.exports = config;
