const path = require("path");

module.exports = {
  watch: false,
  target: "electron-renderer",
  mode: "development",
  devtool: "inline-source-map",
  entry: path.resolve(__dirname, "js", "app.ts"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, "js"),
        loader: "ts-loader",
      },
    ],
  },
};
