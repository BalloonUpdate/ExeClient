export default function(str, from, to)
{
    while(str.indexOf(from) != -1)
        str = str.replace(from, to)
    return str
}