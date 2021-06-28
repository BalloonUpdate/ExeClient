export interface ConfigStructure
{
    api: string
    precalled_command?: string
    postcalled_command?: string
    window_width?: number
    window_height?: number
    parallel?: number
    panic_message?: string
    panic_action?: string
    chunk_size?: number
    timeout?: number
}