import nextConfig from 'eslint-config-next/core-web-vitals';
import rootConfig from '../../eslint.config.mjs';

const config = [...rootConfig, ...nextConfig];

export default config;
