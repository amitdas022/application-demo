module.exports = {
  testEnvironment: 'node',
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/index.js', // Assuming index.js just exports and has no logic to test
  ],
  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ['json', 'text', 'lcov', 'clover'],
  // The test match pattern
  testMatch: ['**/__tests__/**/*.test.js'],
  // Setup files after env
  // setupFilesAfterEnv: ['./jest.setup.js'], // If you have a setup file
  // Transform files with babel-jest
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  // Module file extensions for importing
  moduleFileExtensions: ['js', 'json'],
  // Display name for the project
  displayName: {
    name: 'Backend API Tests',
    color: 'blue',
  },
};
