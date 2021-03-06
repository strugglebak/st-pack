const path = require('path')
const fs = require('fs')
// babylon 主要将源码转成 AST
const babylon = require('babylon') 
// 用来遍历以及更新 AST node
const traverse = require('@babel/traverse').default // es6 模块
// 类似 lodash 的一个用于处理 AST node 的工具库
const t = require('@babel/types')
// 将 AST node 转换成 code
const generator = require('@babel/generator').default // es6 模块
const ejs = require('ejs')
const { SyncHook } = require('tapable')

class Complier {
  constructor(config) {
    // 需要保存的入口文件的路径，如 ./src/index.js
    this.entryId 
    // 需要保存的所有模块的依赖
    this.modules = {}
    this.assert = {} // 输出的资源文件
    this.config = config
    this.entry = config.entry // 入口路径
    this.root = process.cwd() // 项目工作的全局路径

    // 插件的生命周期钩子，这里为了方便统一使用同步的方式
    this.hooks = {
      entryOptions: new SyncHook(),
      afterPlugins: new SyncHook(),
      run: new SyncHook(),
      compile: new SyncHook(),
      afterCompile: new SyncHook(),
      emit: new SyncHook(),
      done: new SyncHook()
    }

    const { plugins } = this.config
    if (Array.isArray(plugins)) {
      plugins.forEach(plugin => {
        plugin.apply(this) // 将 Compiler 这个类传入
      })
    }

    // 插件运行之后发布 afterPlugin 钩子
    this.hooks.afterPlugins.call()
  }

  run() {
    this.hooks.run.call()
    this.hooks.compile.call()
    this.bindModule(path.resolve(this.root, this.entry), true)
    this.hooks.afterCompile.call()
    this.emitFile()
    this.hooks.emit.call()
    this.hooks.done.call()
  }

  // 创建模块间的依赖关系
  bindModule(modulePath, isEntry) {
    const moduleSource = this.getModuleSource(modulePath)
    const moduleName = './' + path.relative(this.root, modulePath)
    isEntry && (this.entryId = moduleName)
    // 将模块的源码进行改造，并且返回一个依赖的列表
    // 主要是将 require 变成 __webpack_require__
    // 然后将 require('./a.js') 变成 __webpack_require__('./src/a.js')
    const { newModuleSource, dependencies } = 
      this.parse(moduleSource, path.dirname(moduleName))
    
    // 把相对路径和模块中的内容对应起来
    this.modules[moduleName] = newModuleSource

    // 模块里面还有依赖的就要递归建立依赖关系
    dependencies.forEach(dp => {
      this.bindModule(path.join(this.root, dp), false)
    })
  }

  // 发射一个打包后的文件
  emitFile() {
    // 输出文件路径
    const { filename } = this.config.output
    const { entryId, modules } = this
    const outputFilePath = path.join(this.config.output.path, filename)
    const template = this.getModuleSource(path.join(__dirname, '../template/main.ejs'))
    const outputFileCode = ejs.render(template, { entryId, modules })

    // 保存输出文件路径
    this.assert[outputFilePath] = outputFileCode

    // 写入对应路径
    fs.writeFileSync(outputFilePath, this.assert[outputFilePath])
  }

  getModuleSource(modulePath) {
    let source = fs.readFileSync(modulePath, 'utf8')
    const { rules } = this.config.module
    for (let i = 0; i < rules.length; i++) {
      // 处理对应 test 下的 use
      const rule = rules[i]
      const { test, use } = rule
      let len = use.length - 1
      // 先匹配 test 正则
      if (test.test(modulePath)) {
        // 匹配对了就处理 loader， 这个是倒着处理的
        function normalLoader() {
          // 获取对应 loader
          const loader = require(use[len--])
          // 转化代码
          source = loader(source)
          // loader 没调用完之前就继续递归调用 loader 来解析代码
          len >= 0 && normalLoader()
        }
        normalLoader()
      }
    }
    return source
  }

  // 解析模块源码
  parse(moduleSource, parentPath) {
    // 将源码转换成 AST
    let ast = babylon.parse(moduleSource)
    // 遍历以及修改 AST node
    const dependencies = []
    traverse(ast, {
      CallExpression(p) { // 调用表达式
        const { node } = p
        let { name } = node.callee
        // 修改调用名，即将 require -> __webpack_require__
        if (name === 'require') {
          node.callee.name = '__webpack_require__'
          // 修改模块名，将其变成 ./src/a.js
          let moduleName = node.arguments[0].value
          // 自动添加后缀名
          moduleName += path.extname(moduleName) ? '' : '.js'
          // 添加父级路径
          moduleName = './' + path.join(parentPath, moduleName)
          // 添加进依赖列表
          dependencies.push(moduleName)
          // 构建 Literal 对象
          node.arguments = [t.stringLiteral(moduleName)]
        }
      }
    })
    // 将 AST 转换成源码
    const newModuleSource = generator(ast).code
    return { newModuleSource, dependencies }
  }
}

module.exports = Complier