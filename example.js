const SspLib = require('./src/index')
const channels = []

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

eSSP.on('OPEN', async () => {
  console.log('Port opened!')
})

eSSP.on('CLOSE', async () => {
  console.log('Port closed!')
})

eSSP.on('READ_NOTE', async result => {
  if (result.channel === 0) return
  const channel = channels[result.channel - 1]
  console.log('READ_NOTE', channel)

  // if (channel.value === 500) {
  //   eSSP.command('REJECT_BANKNOTE')
  // }
})

eSSP.on('NOTE_REJECTED', async result => {
  console.log('NOTE_REJECTED', result)
  console.log(await eSSP.command('LAST_REJECT_CODE'))
})

eSSP.on('CREDIT_NOTE', async result => {
  if (result.channel === 0) return
  const channel = channels[result.channel - 1]

  console.log('CREDIT_NOTE', channel)
})

;(async () => {
  await eSSP.open('/dev/ttyUSB0', serialPortConfig)
  await eSSP.command('SYNC')
  await eSSP.command('HOST_PROTOCOL_VERSION', { version: 6 })
  console.log('disabling payin')
  await eSSP.disable()

  console.log('encryption init')
  await eSSP.initEncryption()
  console.log('SERIAL NUMBER:', (await eSSP.command('GET_SERIAL_NUMBER'))?.info?.serial_number)

  const setup_result = await eSSP.command('SETUP_REQUEST')
  for (let i = 0; i < setup_result.info.channel_value.length; i++) {
    channels[i] = {
      value: setup_result.info.expanded_channel_value[i] * setup_result.info.real_value_multiplier,
      country_code: setup_result.info.expanded_channel_country_code[i],
    }
  }

  console.log('set channel inhibits')
  await eSSP.command('SET_CHANNEL_INHIBITS', {
    channels: Array(channels.length).fill(1),
  })

  console.log('resetting routes')
  const payoutDenoms = [100, 500, 1000, 2000]
  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i]
    // TODO: country code check
    if (!payoutDenoms.includes(channel.value)) {
      await eSSP.command('SET_DENOMINATION_ROUTE', {route: 'cashbox', value: channel.value, country_code: channel.country_code})
    }
  }
  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i]
    // TODO: country code check
    if (payoutDenoms.includes(channel.value)) {
      await eSSP.command('SET_DENOMINATION_ROUTE', {route: 'payout', value: channel.value, country_code: channel.country_code})
    }
  }

  console.log('checking routes')
  for (const channel of channels) {
    console.log(channel, (await eSSP.command('GET_DENOMINATION_ROUTE', {value: channel.value, country_code: channel.country_code}))?.info)
  }

  console.log('enable refill mode')
  await eSSP.command('SET_REFILL_MODE', { mode: 'on' })

  console.log('enable payin')
  await eSSP.enable()

  console.log('enable payout')
  await eSSP.command('ENABLE_PAYOUT_DEVICE', {REQUIRE_FULL_STARTUP: false, GIVE_VALUE_ON_STORED: true})

  console.log('get levels')
  const levels = (await eSSP.command('GET_ALL_LEVELS'))?.info?.counter;
  console.log(levels)
})()
