const postcss = require("postcss")
const tailwindcss = require("tailwindcss")
const selectorParser = require("postcss-selector-parser")
const { merge } = require("lodash")
const deasync = require("deasync-promise")
const camelcase = require("camelcase-css")

const parser = selectorParser()

function objectify(node) {
  let name
  const result = {}

  node.each(function(child) {
    if (child.type === "atrule") {
      name = `@${child.name}`
      if (child.params) name += ` ${child.params}`

      child.each((n) => {
        const {
          nodes: [selector],
        } = parser.astSync(n)
        const selectorName = selector.first.value

        const body = objectify(n)

        result[selectorName] = merge(result[selectorName], { [name]: body })
      })
    } else if (child.type === "rule") {
      const {
        nodes: [selector],
      } = parser.astSync(child)
      const selectorName = selector.first.value

      let body = objectify(child)

      if (selector.last.type === "pseudo") {
        body = { [selector.last.value]: body }
      }

      result[selectorName] = merge(result[selectorName], body)
    } else if (child.type === "decl") {
      name = camelcase(child.prop)
      let { value } = child
      if (child.important) value += " !important"
      if (typeof result[name] === "undefined") {
        result[name] = value
      } else if (Array.isArray(result[name])) {
        result[name].push(value)
      } else {
        result[name] = [result[name], value]
      }
    }
  })
  return result
}

function parseTailwindClassNames(config) {
  return postcss([tailwindcss(config)])
    .process("@tailwind components; @tailwind utilities", {
      from: "tailwind.config.js",
    })
    .then((result) => objectify(result.root))
}

module.exports = function({ types: t, ...x }) {
  let tailwindClassNames
  return {
    name: "tailwindjs",
    visitor: {
      Program(path, state) {
        if (!tailwindClassNames) {
          tailwindClassNames = deasync(parseTailwindClassNames(state.opts.config))
        }
      },
      CallExpression(path, { opts }) {
        const { node } = path
        const { name = "twjs" } = opts

        if (
          node.callee.name === name &&
          (t.isStringLiteral(node.arguments[0]) ||
            t.isArrayExpression(node.arguments[0]))
        ) {
          let selectors = Array.isArray(node.arguments[0].elements)
            ? node.arguments[0].elements
            : node.arguments[0].value.trim().split(/\s+/)

          if (t.isStringLiteral(selectors[0])) {
            selectors = selectors.map((s) => s.value)
          }

          const result = selectors.reduce((acc, className) => {
            const rule = tailwindClassNames[className]
            if (!rule) {
              throw new Error(`Unknown tailwindcss class '${className}'`)
            }
            return merge(acc, rule)
          }, {})

          path.replaceWithSourceString(JSON.stringify(result))
        }
      },
    },
  }
}
