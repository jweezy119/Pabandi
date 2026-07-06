import "./index.css";
import { Composition } from "remotion";
import { LiveSellingAd } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LiveSellingAd"
        component={LiveSellingAd}
        durationInFrames={1150}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
