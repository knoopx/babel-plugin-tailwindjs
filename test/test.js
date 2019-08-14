const fs = require("fs")

const path = require("path")
const pluginTester = require("babel-plugin-tester")
const yaml = require("js-yaml")

const tests = yaml.load(
  fs.readFileSync(path.resolve(__dirname, "./tests.yaml"), "utf-8"),
)

const plugin = require("..")

pluginTester({
  plugin,
  tests,
})
