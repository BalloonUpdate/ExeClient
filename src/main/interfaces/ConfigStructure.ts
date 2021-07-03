export interface ConfigStructure
{
    // 主线程负责读取
    api: string
    assets?: string
    dev_tools?: boolean
    window_width?: number
    window_height?: number

    // 渲染程负责读取
    postcalled_command?: string
    error_message?: string
    error_help?: string
}