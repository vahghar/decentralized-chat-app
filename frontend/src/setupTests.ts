import '@testing-library/jest-dom';
// jsdom doesn't support structuredClone which is sometimes used internally by subtle crypto polyfills
// so we'll just test the core logic.
