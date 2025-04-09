export type AtlasEntry = {
  scale: [number, number];
  offset: [number, number];
};

type Values<T extends readonly unknown[]> = T[number];

const entryKeysMap = {"flowers":["2","chatGPTImageApr92025010111AM","chatGPTImageApr92025125808AM","dandelionDiffusecopy"],"onePiece":["luffyDifuse","robinDiffuse","sanjiDiffuse","zoroDiffuse"],"stones":["stoneDiffuse","stoneMossyDiffuse","stoneMossyNormalAo","stoneNormalAo"]} as const
export type Atlases = {
  [K in keyof typeof entryKeysMap]: {
    [T in Values<typeof entryKeysMap[K]>]: AtlasEntry;
  };
}