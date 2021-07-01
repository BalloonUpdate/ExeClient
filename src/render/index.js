var vue = new Vue({
    el: '#vue-container',
    data: {
        text1: '',
        progress1: 0,
        text2: '',
        progress2: 0,
    }
})

function dec(num)
{
    return parseInt(num * 10)/10
}

function exit()
{
    if('postcalled_command' in config && config.postcalled_command != '')
        updaterApi.execute(config.postcalled_command).then(() => {
            updaterApi.close()

        })
    
}

var ex_translations = {
    AmbiguousFileTypeException: '有歧义的文件类型(内部错误)',
    ConfigFileNotFoundException: '找不到配置文件',
    ConnectionClosedException: '连接关闭/传输中断(通常是网络原因)',
    FileNotExistException: '找不到文件(内部错误)',
    HTTPResponseException: 'HTTP请求/连接失败(通常是网络原因)',
    IsADirectoryException: '不是一个文件引发的错误(内部错误)',
    IsAFileException: '不是一个目录引发的错误(内部错误)',
    MissingParameterException: '缺少必要参数错误(内部错误)',
    UnableToDecodeException: '服务器返回了无法解码的数据(非yaml格式)',
    UnexpectedHttpCodeExcepetion: '不正确的HTTP状态码(未处于2xx-3xx之间)',
    UnknownWorkModeException: '未知的工作模式'
}

var config = null
var totalBytes = 0
var receivedBytes = 0
var totalFileCount = 0
var downloadFileCount = 0

updaterApi.on('init', function(_config) {
    config = _config
    this.start()

    console.log(config)

    this.setTitle('文件更新')
    vue.text2 = '正在连接服务器..'
})

updaterApi.on('check_for_upgrade', function() {
    vue.text2 = '检查文件..'
})

updaterApi.on('upgrading_new_files', function(paths) {
    totalFileCount = paths.length
    for(let p of paths) {
        let path = p[0]
        let len = p[1]
        let hash = p[2]
        totalBytes += len
    }
})

updaterApi.on('upgrading_downloading', function(file, recv, bytes, total) {
    receivedBytes += recv

    // 下载完成时
    if(bytes==total)
        downloadFileCount += 1

    let totalProgress = dec(receivedBytes/totalBytes*10000)
    let currentProgress = dec(bytes/total*10000)
    let totalProgressIn100 = dec(totalProgress/100)
    let currentProgressIn100 = dec(currentProgress/100)

    vue.progress1 = currentProgress
    vue.progress2 = totalProgress
    vue.text1 = file
    vue.text2 = '下载新文件 '+totalProgressIn100+'%  -  '+(downloadFileCount+1)+'/'+totalFileCount
    this.setTitle('下载新文件 '+totalProgressIn100+'%')
})

updaterApi.on('upgrading_before_installing', function() {
    vue.text2 = '等待重新启动..'
})

//    -------------------------------------

updaterApi.on('check_for_update', function() {
    vue.text2 = '校验文件...'
})

updaterApi.on('updating_new_files', function(paths) {
    totalFileCount = paths.length
    for(let p of paths) {
        let path = p[0]
        let len = p[1]
        totalBytes += len
    }
})

var lastUpdate = 0
var lastFile = ''
updaterApi.on('updating_downloading', function(file, recv, bytes, total) {
    receivedBytes += recv

    // 下载完成时
    if(bytes==total)
        downloadFileCount += 1

    let totalProgress = dec(receivedBytes/totalBytes*10000)
    let currentProgress = dec(bytes/total*10000)
    let totalProgressIn100 = dec(totalProgress/100)
    let currentProgressIn100 = dec(currentProgress/100)

    let filename = file.lastIndexOf('/')!=-1? file.substring(file.lastIndexOf('/')+1):file
    let ts = new Date().getTime()
    if(ts-lastUpdate > 800)
    {
        vue.progress1 = currentProgress
        vue.text1 = filename
        lastUpdate = ts
        lastFile = filename
    } else {
        if(lastFile==filename)
            vue.progress1 = currentProgress
    }

    vue.progress2 = totalProgress
    vue.text2 = totalProgressIn100+'%  -  '+(downloadFileCount+1)+'/'+totalFileCount

    this.setTitle('下载新文件 '+totalProgressIn100+'%')
})

updaterApi.on('cleanup', function() {
    this.setTitle('文件更新')
    vue.text2 = totalFileCount>0? '更新完毕!':'所有文件已是最新!'

    if('hold_ui' in config && config.hold_ui)
        $('#exit-button').css('display', 'flex')
    else if('visible_time' in config && config.visible_time >= 0) {
        setTimeout(() => exit(), config.visible_time);
    } else {
        exit()
    }
})

updaterApi.on('on_error', function(type, detail, isPyException, traceback) {
    if(type in ex_translations)
        type += '('+ex_translations[type]+')'

    alert(type+'\n\n'+detail+'\n\n'+traceback)
    // alert(traceback)
    
    // if(isPyException && confirm('是否显示错误详情? (请将错误报告给开发者)'))
    //     alert(trackback)

    if(config != null)
        if('error_message' in config && confirm(config.error_message))
            if('error_help' in config)
                this.execute(config.error_help)
    
    updaterApi.close()
})

