import webpack from "webpack";
import path from "path";
import {fileURLToPath} from "url";
import AmbientDtsPlugin from "./plugins/AmbientDtsPlugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devMode = process.env.NODE_ENV !== "production";

const baseConfig: webpack.Configuration = {
  devtool: devMode ? "source-map" : false,
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  resolveLoader: {
    modules: ["node_modules", path.resolve(__dirname, "loaders")],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: "/node_modules/",
        options: {
          configFile: "tsconfig.build.json",
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource'
      }
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      BASEPATH: JSON.stringify(""),
    }),
  ],
  experiments: {
    outputModule: true,
  },
  externals: {
    "monaco-editor": "monaco-editor",
  },
};

function createOutputConfig(
  outputFile: string,
  entry: string,
  type: "module" | "commonjs",
) {
  return {
    ...baseConfig,
    entry: {
      index: entry,
    },
    output: {
      filename: outputFile,
      path: path.resolve(__dirname, "dist"),
      library: {
        type: type,
      },
      globalObject: 'self',
      chunkFilename: '[name].index.js',
    },
  };
}

const indexEsmConfig: webpack.Configuration = {
  ...createOutputConfig("index.js", "./src/index.ts", "module"),
  plugins: [
    ...(baseConfig.plugins || []),
    new AmbientDtsPlugin({
      outputPath: path.resolve(__dirname, "dist", "ambient.d.ts"),
      dtsDir: path.resolve(__dirname, "dist"),
    }),
  ],
};

const indexCjsConfig: webpack.Configuration = createOutputConfig(
  "index.cjs",
  "./src/index.ts",
  "commonjs",
);

export default [
  indexEsmConfig,
  indexCjsConfig,
];
