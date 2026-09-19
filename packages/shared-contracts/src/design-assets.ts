export interface DesignAssetItem {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  type: 'image' | 'svg' | 'font';
  size: number;
  ext: string;
}

export interface ColorToken {
  hex: string;
  count: number;
}

export interface TypographySample {
  name: string;
  family: string;
  weight: string;
  sample: string;
}

export interface DesignOverview {
  assets: DesignAssetItem[];
  colors: ColorToken[];
  typography: TypographySample[];
  stats: {
    images: number;
    svgs: number;
    fonts: number;
    colors: number;
  };
}
