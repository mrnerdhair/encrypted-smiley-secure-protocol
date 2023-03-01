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

  console.log('enable payin')
  await eSSP.enable()

  console.log('enable payout')
  await eSSP.command('ENABLE_PAYOUT_DEVICE', {REQUIRE_FULL_STARTUP: false, GIVE_VALUE_ON_STORED: true})

  console.log('get levels')
  const levels = (await eSSP.command('GET_ALL_LEVELS'))?.info?.counter;
  console.log(levels)

  const amount = levels.map(x => x.value * x.denomination_level).reduce((a, x) => a + x, 0)
  console.log('payout all', amount)

  console.log(await eSSP.command('PAYOUT_AMOUNT', {
    amount,
    country_code: 'USD',
    test: false,
  }))

  console.log('Done.')
  await eSSP.close()
})()
