import * as Path from "path";
import alias from "rollup-plugin-alias";

export default {
   input: "tempBuild/Main.js",
   output: {
      file: "app.js",
      format: "iife"
   },
   plugins: [
      alias({
         "pink-trombone-mod": Path.resolve("../dist")
      })
   ]
};
