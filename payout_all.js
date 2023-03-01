const SspLib = require('./src/index')
const channels = [{ value: 0, country_code: 'XXX' }]

const serialPortConfig = {
  baudRate: 9600, // default: 9600
  dataBits: 8, // default: 8
  stopBits: 2, // default: 2
  parity: 'none', // default: 'none'
}

const eSSP = new SspLib({
  id: 0x00,
  debug: false, // default: false
  timeout: 3000, // default: 3000
  encryptAllCommand: true, // default: true
  fixedKey: '0123456701234567', // default: '0123456701234567'
})

eSSP.on('OPEN', () => {
  console.log('Port opened!')
})

eSSP.on('CLOSE', () => {
  console.log('Port closed!')
})

eSSP.on('READ_NOTE', result => {
  if (result.channel === 0) return
  console.log('READ_NOTE', result, channels[result.channel])

  if (channels[result.channel].value === 500) {
    eSSP.command('REJECT_BANKNOTE')
  }
})

eSSP.on('NOTE_REJECTED', result => {
  console.log('NOTE_REJECTED', result)

  eSSP.command('LAST_REJECT_CODE').then(result => {
    console.log(result)
  })
})

eSSP
  .open('/dev/ttyUSB0', serialPortConfig)
  .then(() => eSSP.command('SYNC'))
  .then(() => eSSP.command('HOST_PROTOCOL_VERSION', { version: 6 }))
  .then(() => eSSP.initEncryption())
  .then(() => eSSP.command('GET_SERIAL_NUMBER'))
  .then(result => {
    console.log('SERIAL NUMBER:', result.info.serial_number)
    return
  })
  .then(() => eSSP.command('SETUP_REQUEST'))
  .then(result => {
    for (let i = 0; i < result.info.channel_value.length; i++) {
      channels[i] = {
        value: result.info.expanded_channel_value[i],
        country_code: result.info.expanded_channel_country_code[i],
      }
    }
    return
  })
  .then(() => eSSP.command('SET_CHANNEL_INHIBITS', {
    channels: Array(channels.length).fill(1),
  }))
  .then(() => eSSP.enable())
  .then(async () => {
    console.log('enable payout')
    console.log(await eSSP.command('ENABLE_PAYOUT_DEVICE', {REQUIRE_FULL_STARTUP: false, GIVE_VALUE_ON_STORED: true}))
    console.log('get levels')
    const levels = (await eSSP.command('GET_ALL_LEVELS'))?.info?.counter;
    const levels2 = [];
    for (let i = 1; i in levels; i++) {
      levels2.push(levels[i])
    }
    console.log(levels, levels2)
    const amount = levels2.map(x => x.value * x.denomination_level).reduce((a, x) => a + x, 0)
    console.log('payout all', amount)
    console.log(await eSSP.command('PAYOUT_AMOUNT', {
      amount,
      country_code: 'USD',
      test: false,
    }))
    console.log('GO!!!')
  })
  .catch(error => {
    console.log(error)
  })
