/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />

declare module '@react-google-maps/api' {
  export const GoogleMap: any;
  export function useJsApiLoader(options: any): { isLoaded: boolean; loadError?: Error };
  export const Marker: any;
}

declare namespace google {
  export namespace maps {
    export enum Animation {
      BOUNCE = 1,
      DROP = 2
    }
  }
}
