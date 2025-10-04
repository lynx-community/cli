import fs from 'fs-extra';
import path from 'path';

export async function setupTailwind(targetPath: string): Promise<void> {
  // Update package.json with Tailwind dependencies
  await updatePackageJsonForTailwind(targetPath);

  // Create postcss.config.js
  await createPostCSSConfig(targetPath);

  // Create tailwind.config.ts
  await createTailwindConfig(targetPath);

  // Update App.css with Tailwind directives
  await updateAppCSSForTailwind(targetPath);

  // Update App.tsx with Tailwind classes
  await updateAppTSXForTailwind(targetPath);
}

async function updatePackageJsonForTailwind(targetPath: string): Promise<void> {
  const packageJsonPath = path.join(targetPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);

  // Add Tailwind CSS dependencies
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    tailwindcss: '^3',
    '@lynx-js/tailwind-preset': 'latest',
  };

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
}

async function createPostCSSConfig(targetPath: string): Promise<void> {
  const postCSSConfig = `export default {
  plugins: {
    tailwindcss: {},
  },
};
`;

  const configPath = path.join(targetPath, 'postcss.config.js');
  await fs.writeFile(configPath, postCSSConfig, 'utf8');
}

async function createTailwindConfig(targetPath: string): Promise<void> {
  const tailwindConfig = `import lynxPreset from '@lynx-js/tailwind-preset';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [lynxPreset],
};
`;

  const configPath = path.join(targetPath, 'tailwind.config.ts');
  await fs.writeFile(configPath, tailwindConfig, 'utf8');
}

async function updateAppCSSForTailwind(targetPath: string): Promise<void> {
  const appCSSContent = `@tailwind base;
@tailwind components;
@tailwind utilities;
:root {
  background-color: #000;
  --color-text: #fff;
}
.Background {
  position: fixed;
  background: radial-gradient(
    71.43% 62.3% at 46.43% 36.43%,
    rgba(18, 229, 229, 0) 15%,
    rgba(239, 155, 255, 0.3) 56.35%,
    #ff6448 100%
  );
  box-shadow: 0px 12.93px 28.74px 0px #ffd28db2 inset;
  border-radius: 50%;
  width: 200vw;
  height: 200vw;
  top: -60vw;
  left: -14.27vw;
  transform: rotate(15.25deg);
}

`;

  const appCSSPath = path.join(targetPath, 'src', 'App.css');
  await fs.writeFile(appCSSPath, appCSSContent, 'utf8');
}

async function updateAppTSXForTailwind(targetPath: string): Promise<void> {
  const appTSXContent = `
  import { useCallback, useEffect, useState } from '@lynx-js/react';

import './App.css';
import arrow from './assets/arrow.png';
import lynxLogo from './assets/lynx-logo.png';
import reactLynxLogo from './assets/react-logo.png';

export function App(props: { onRender?: () => void }) {
  const [alterLogo, setAlterLogo] = useState(false);

  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);
  props.onRender?.();

  const onTap = useCallback(() => {
    'background only';
    setAlterLogo((prevAlterLogo) => !prevAlterLogo);
  }, []);

  return (
    <view>
      <view className="fixed Background rounded-full w-[200vw] h-[200vw] -top-[60vw] -left-[14.27vw] rotate-[15.25deg]" />
      <view className="relative min-h-screen flex flex-col items-center justify-center">
        <view className="flex-[5] flex flex-col items-center justify-center z-[100]">
          <view
            className="flex flex-col items-center justify-center mb-2"
            bindtap={onTap}
          >
            {alterLogo ? (
              <image
                src={reactLynxLogo}
                className="w-[100px] h-[100px] animate-spin duration-[20s]"
              />
            ) : (
              <image
                src={lynxLogo}
                className="w-[100px] h-[100px] animate-pulse duration-500"
              />
            )}
          </view>
          <text className="text-[36px] font-bold text-white">React</text>
          <text className="italic text-[22px] font-semibold mb-2 text-white">
            on Lynx
          </text>
        </view>
        <view className="flex flex-col items-center justify-center">
          <image src={arrow} className="w-6 h-6" />
          <text className="text-[20px] text-white/85 my-[15px]">
            Tap the logo and have fun!
          </text>
          <text className="text-xs my-[5px] text-white/65">
            Edit
            <text className="italic text-white/85">{' src/App.tsx '}</text>
            to see updates!
          </text>
        </view>
        <view className="flex-1" />
      </view>
    </view>
  );
} `;

  const appTSXPath = path.join(targetPath, 'src', 'App.tsx');
  await fs.writeFile(appTSXPath, appTSXContent, 'utf8');
}
