import { ChainType } from "../../types";

const typeSubstrate: ChainType = "substrate";
// commented for now. We will use eth chain types soon™
// const typeEthereum: ChainType = "ethereum";

export const polkadotChains = {
  polkadot: {
    id: "polkadot",
    display: "Polkadot",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fpolkadot.png&w=96&q=75",
    paraChainId: -1,
    ss58Prefix: 0,
  },
  statemint: {
    id: "statemint",
    display: "Polkadot Asset Hub",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fstatemine.png&w=96&q=75",
    paraChainId: 1000,
    ss58Prefix: 0,
  },
  acala: {
    id: "acala",
    display: "Acala",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Facala.png&w=96&q=75",
    paraChainId: 2000,
    ss58Prefix: 10,
  },
  parallel: {
    id: "parallel",
    display: "Parallel",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fparallel.png&w=96&q=75",
    paraChainId: 2012,
    ss58Prefix: 172,
  },
  // moonbeam: {
  //   id: "moonbeam",
  //   display: "Moonbeam",
  //   type: typeEthereum,
  //   icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fmoonbeam.png&w=96&q=75",
  //   paraChainId: 2004,
  //   ss58Prefix: 1284,
  // },
  astar: {
    id: "astar",
    display: "Astar",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fastar.png&w=96&q=75",
    paraChainId: 2006,
    ss58Prefix: 5,
  },
  bifrost_polkadot: {
    id: "bifrost_polkadot",
    display: "Bifrost",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fbifrost.png&w=96&q=75",
    paraChainId: 2030,
    ss58Prefix: 6,
  },
  interlay: {
    id: "interlay",
    display: "Interlay",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Finterlay.png&w=96&q=75",
    paraChainId: 2032,
    ss58Prefix: 2032,
  },
  hydra: {
    id: "hydra",
    display: "Hydration",
    type: typeSubstrate,
    icon: "https://resources.acala.network/_next/image?url=%2Fnetworks%2Fhydration.png&w=96&q=75",
    paraChainId: 2034,
    ss58Prefix: 63,
  },
  phala: {
    id: "phala",
    display: "Phala",
    type: typeSubstrate,
    icon: "",
    paraChainId: 2035,
    ss58Prefix: 30,
  },
};
