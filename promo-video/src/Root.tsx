import { Composition } from 'remotion';
import { PromoVideo } from './PromoVideo';
import './style.css';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="PabandiPromo"
        component={PromoVideo}
        durationInFrames={450} // 15 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
