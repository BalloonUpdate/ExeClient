// copied from https://blog.csdn.net/qq_36742720/article/details/87863359

export default function(bytes)
{
    if (isNaN(bytes))
        return ''
    var symbols = ['B', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb']
    var exp = Math.floor(Math.log(bytes)/Math.log(2))
    if (exp < 1)
        exp = 0
    var i = Math.floor(exp / 10)
    bytes = bytes / Math.pow(2, 10 * i);
    if (bytes.toString().length > bytes.toFixed(2).toString().length)
        bytes = bytes.toFixed(2)
    return bytes + ' ' + symbols[i];
}