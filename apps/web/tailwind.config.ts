import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                ink: '#0b1b2b',
                steel: '#1f3a52',
                sand: '#f0e7d8',
                clay: '#d7b08a',
                cactus: '#2f6b5f',
                ember: '#d86f45',
            },
            boxShadow: {
                glass: '0 10px 30px rgba(15, 23, 42, 0.18)',
            },
            borderRadius: {
                xl: '1.25rem',
            },
        },
    },
    plugins: [],
};

export default config;
