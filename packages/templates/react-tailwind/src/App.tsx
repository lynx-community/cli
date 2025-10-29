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
}
