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
    {
        let cmd = config.postcalled_command
        let async = cmd.startsWith('+')
        cmd = async? cmd.substring(1):cmd

        if(async)
        {
            updaterApi.execute(cmd)
            updaterApi.close()
        } else {
            updaterApi.execute(cmd).then(() => updaterApi.close())
        }
    } else {
        updaterApi.close()
    }
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
    UnknownWorkModeException: '未知的工作模式',
    RedirectionFailedException: '重定向出错',
    MaxRedirectionReachedException: '重定向次数过多'
}

var config = null
var totalBytes = 0
var receivedBytes = 0
var totalFileCount = 0
var downloadFileCount = 0

var ip_masked = ''

updaterApi.on('init', function(_config) {
    config = _config
    this.start()

    console.log(config)

    this.setTitle('文件更新')
    vue.text2 = '正在连接服务器..'

    if('api' in config && 'ip_mask' in config && config.ip_mask)
    {
        let r = new RegExp("(?<=://)[^/]+(?=/.*)", 'g').exec(config.api)
        if(r != null)
            ip_masked = r[0]
    }

    // 加载公告
    if('announcement_api' in config && config.announcement_api)
    {
        $(function() {
            $('#announcement').css('display', 'block')
            let ann = $('#announcement')
            ann.html('公告加载中...')
            fetch(config.announcement_api, {
                cache: 'no-cache'
            }).then(async data => {
                ann.html(await data.text())
            }).catch((e) => {
                ann.html('公告加载失败'+e)
            })
        })
    }
})

updaterApi.on('check_for_update', function() {
    vue.text2 = '校验文件...'
})

updaterApi.on('updating_hashing', function(file, hashed, total) {
    vue.progress1 = dec(hashed/total*10000)
    vue.text2 = '校验文件...'
    vue.text1 = file
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
    vue.text1 = ''
    vue.progress1 = 0
    vue.progress2 = 0

    if('hold_ui' in config && config.hold_ui)
    {
        // $('#exit-button').css('display', 'flex')
    }
    else if('visible_time' in config && config.visible_time >= 0) {
        setTimeout(() => exit(), config.visible_time);
    } else {
        exit()
    }
})

updaterApi.on('on_error', function(type, detail, traceback) {
    // ip打码
    if(ip_masked != '')
    {
        detail = detail.replace(new RegExp(ip_masked.replace(/\\./g, '.'), 'g'), '***')
        traceback = traceback.replace(new RegExp(ip_masked.replace(/\\./g, '.'), 'g'), '***')
    }

    if(type in ex_translations)
        type += '('+ex_translations[type]+')'

    if(confirm(type+'\n\n'+detail+'\n\n点击确定显示详细信息(调用堆栈)，点击取消关闭页面'))
        alert(traceback)

    if(config != null)
        if('error_message' in config && confirm(config.error_message))
            if('error_help' in config)
                this.execute(config.error_help)
    
    updaterApi.close()
})

