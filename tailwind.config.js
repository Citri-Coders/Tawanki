/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './*.html',
        './supabase-config.js'
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0d631b',
                'primary-container': '#3D7A3D',
                secondary: '#1B6E3C',
                'secondary-container': '#94C078',
                'surface-bright': '#F4EFE2',
                background: '#F4EFE2',
                surface: '#F4EFE2',
                'surface-white': '#FBF8F0',
                'text-main': '#2A2114',
                'text-muted': '#6B5E47',
                'green-light-bg': '#E8F0DC',
                'outline-variant': '#C9BC9A',
                outline: '#8B7B5C',
                error: '#A33A1A',
                'error-red': '#B5391E',
                'warning-orange': '#D97706',
                tertiary: '#C9612A',
                'tertiary-container': '#C9612A',
                'on-surface': '#2A2114',
                'on-background': '#2A2114',
                'on-primary': '#FFFFFF',
                'on-secondary': '#FFFFFF',
                'on-tertiary': '#FFFFFF',
                'on-error': '#FFFFFF',
                'on-error-container': '#7A0E1A',
                'on-surface-variant': '#4A3F2A',
                'inverse-surface': '#3A2E1F',
                'inverse-primary': '#7BAF6E',
                'inverse-on-surface': '#FBF8F0',
                'surface-container': '#EFE7D2',
                'surface-container-low': '#EFE9D7',
                'surface-container-lowest': '#FFFCF5',
                'surface-container-high': '#E2D8BE',
                'surface-container-highest': '#D9CFB4',
                'surface-variant': '#E2D8BE',
                'surface-dim': '#D9CFB4',
                'surface-tint': '#0d631b',
                'secondary-fixed': '#94C078',
                'secondary-fixed-dim': '#6FA85A',
                'on-secondary-fixed': '#0A2A06',
                'on-secondary-fixed-variant': '#0D3A0A',
                'on-secondary-container': '#0D3A0A',
                'tertiary-fixed': '#F0D9A8',
                'tertiary-fixed-dim': '#D89A4A',
                'on-tertiary-fixed': '#3D2810',
                'on-tertiary-fixed-variant': '#7A4012',
                'on-tertiary-container': '#3D2810',
                'primary-fixed': '#A3D49A',
                'primary-fixed-dim': '#6FA85A',
                'on-primary-fixed': '#002204',
                'on-primary-fixed-variant': '#003A0A',
                'on-primary-container': '#CBFFC2',
                'error-container': '#F5D6CC'
            },
            borderRadius: {
                DEFAULT: '0.375rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
                full: '9999px'
            },
            spacing: {
                'space-1': '4px',
                'space-2': '8px',
                'space-3': '12px',
                'space-4': '16px',
                'space-6': '24px',
                'space-8': '32px',
                'margin-mobile': '16px',
                'margin-desktop': '32px',
                gutter: '16px'
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                'body-md': ['Inter', 'sans-serif'],
                'headline-h3': ['Inter', 'sans-serif'],
                'label-sm': ['Inter', 'sans-serif'],
                button: ['Inter', 'sans-serif'],
                'display-stat': ['Inter', 'sans-serif'],
                'headline-h2': ['Inter', 'sans-serif'],
                'headline-h1': ['Inter', 'sans-serif']
            },
            fontSize: {
                'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
                'headline-h3': ['18px', { lineHeight: '24px', fontWeight: '600' }],
                'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.025em', fontWeight: '500' }],
                button: ['14px', { lineHeight: '20px', fontWeight: '500' }],
                'display-stat': ['32px', { lineHeight: '40px', fontWeight: '700' }],
                'headline-h2': ['20px', { lineHeight: '28px', fontWeight: '600' }],
                'headline-h1': ['24px', { lineHeight: '32px', fontWeight: '700' }]
            }
        }
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries')
    ]
};
