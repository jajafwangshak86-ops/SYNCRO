module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    setupFiles: ['<rootDir>/tests/setup.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.js$': ['ts-jest', { diagnostics: false }],
    },
    globals: {
        'ts-jest': {
            diagnostics: false,
            tsconfig: {
                target: 'ES2022',
                module: 'commonjs',
                esModuleInterop: true,
                skipLibCheck: true,
            },
        },
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(@stellar/stellar-sdk|uuid))',
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
};
