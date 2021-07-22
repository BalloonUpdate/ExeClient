const sleep2 = (timeountMS) => new Promise((resolve) => {
    setTimeout(resolve, timeountMS);
});

async function test() {
    updaterApi.dispatchEvent('init', {})
    await sleep2(100)
    updaterApi.dispatchEvent('check_for_upgrade', 'https://baidu.com')
    await sleep2(100)

    await sleep2(500)

    let new_files = [
        ['.minecraft/mods/ZeroCore2-1.16.4-2.0.+7.jar', 649672],
        ['.minecraft/mods/keng.jar', 36553],
        ['.minecraft/mods/updater-php - 快捷方式.jar', 543546],
        ['.minecraft/mods/vue-2.6.12.js', 37246],
    ]

    updaterApi.dispatchEvent('updating_new_files', new_files)

    for (const file of new_files) {
        let filename = file[0]
        let filelen = file[1]
        let download = 0
        let speed = 64 * 1024
        let lastBytes = filelen % speed
        let count = parseInt(filelen / speed) + (lastBytes!=0? 1:0)
        
        updaterApi.dispatchEvent('updating_downloading', filename, 0, 0, filelen)
        for(let i=0;i<count;i++) {
            let trans = i==count-1 && lastBytes!=0? lastBytes:speed
            download += trans
            updaterApi.dispatchEvent('updating_downloading', filename, trans, download, filelen)
            await sleep2(Range2(110, 140))
        }
    }

    await sleep2(100)
    updaterApi.dispatchEvent('cleanup')
}

function Range2(min, max) { 
    return Math.floor(Math.random()*(max-min+1)+min) 
}