const sleep2 = (timeountMS) => new Promise((resolve) => {
    setTimeout(resolve, timeountMS);
});


async function test_(isupgrade) {
    updaterApi.dispatchEvent('init', {})
    await sleep2(100)
    updaterApi.dispatchEvent('check_for_upgrade', 'https://baidu.com')
    await sleep2(100)
    updaterApi.dispatchEvent('calculate_differences_for_upgrade')
    await sleep2(100)
    updaterApi.dispatchEvent('whether_upgrade', isupgrade)
    await sleep2(100)

    if(isupgrade) {
        let old_files = [
            ['UpdaterHotupdatePackage.exe', true]
        ]
        let new_files = [
            ['2.6dev0', 835644, 'cc101a36a955aade313ea815e30234f557d622d2'],
            ['UpdaterHotupdatePackage.exe', 7018479, '8b321031c8b47f2bb6a273171d51b71b039b2579']
        ]
    
        updaterApi.dispatchEvent('upgrading_new_files', new_files)
        await sleep2(100)
    
        updaterApi.dispatchEvent('upgrading_before_downloading')
        await sleep2(100)
    
        // 开始下载
        for (const file of new_files) {
            let filename = file[0]
            let filelen = file[1]
            let download = 0
            let speed = 64 * 1024
            let lastBytes = filelen % speed
            let count = parseInt(filelen / speed) + (lastBytes!=0? 1:0)

            updaterApi.dispatchEvent('upgrading_downloading', filename, 0, 0, filelen)
            for(let i=0;i<count;i++) {
                let trans = i==count-1 && lastBytes!=0? lastBytes:speed
                download += trans
                updaterApi.dispatchEvent('upgrading_downloading', filename, trans, download, filelen)
                await sleep2(130)
            }
        }
    
        updaterApi.dispatchEvent('upgrading_before_installing')
    } else {
        updaterApi.dispatchEvent('check_for_update', 'https://127.0.0.1.com')
        await sleep2(100)
        updaterApi.dispatchEvent('calculate_differences_for_update')
        await sleep2(100)

        await sleep2(500)

        let new_files = [
            // ['.minecraft/mods/ZeroCore2-1.16.4-2.0.+7.jar', 649672],
            // ['.minecraft/mods/keng.jar', 36553],
            // ['.minecraft/mods/updater-php - 快捷方式.jar', 543546],
            // ['.minecraft/mods/vue-2.6.12.js', 37246],
        ]

        updaterApi.dispatchEvent('updating_new_files', new_files)
        await sleep2(100)
        updaterApi.dispatchEvent('updating_before_downloading')

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
                await sleep2(Range(110, 140))
            }
        }

        await sleep2(100)
        updaterApi.dispatchEvent('cleanup')
    }
}

function Range(min, max) { 
    return Math.floor(Math.random()*(max-min+1)+min) 
}

function testA() {
    test_(true)
}

function testB() {
    test_(false)
}