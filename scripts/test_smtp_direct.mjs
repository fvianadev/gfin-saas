import net from 'net'
import tls from 'tls'

const HOST = 'smtp.gmail.com'
const PORT = 587
const FROM = 'francionildoviananeres@gmail.com'
const TO = 'francionildoviananeres@gmail.com'

const email = process.argv[2] || FROM
const password = process.argv[3]

if (!password) {
  console.error('Uso: node scripts/test_smtp_direct.mjs <email> <senha-de-app>')
  process.exit(1)
}

function sendCommand(socket, cmd) {
  return new Promise((resolve) => {
    socket.write(cmd + '\r\n')
    console.log('C: ' + cmd)
    const onData = (data) => {
      const str = data.toString()
      console.log('S: ' + str.trim())
      if (str[3] === ' ') {
        socket.removeListener('data', onData)
        resolve(str)
      }
    }
    socket.on('data', onData)
  })
}

async function test() {
  const socket = net.connect(PORT, HOST, async () => {
    console.log('\n--- Conectado ao SMTP Gmail ---\n')

    // Wait for initial banner
    const banner = await new Promise(resolve => {
      socket.once('data', (data) => {
        console.log('S: ' + data.toString().trim())
        resolve(data.toString())
      })
    })

    await sendCommand(socket, 'EHLO gfin.local')
    await sendCommand(socket, 'STARTTLS')

    // Upgrade to TLS
    const tlsSocket = tls.connect({ socket, host: HOST }, async () => {
      console.log('\n--- TLS estabelecido ---\n')

      // Wait for TLS banner
      await new Promise(resolve => {
        tlsSocket.once('data', (data) => {
          console.log('S: ' + data.toString().trim())
          resolve()
        })
      })

      await sendCommand(tlsSocket, 'EHLO gfin.local')

      // AUTH LOGIN
      await sendCommand(tlsSocket, 'AUTH LOGIN')
      await sendCommand(tlsSocket, Buffer.from(email).toString('base64'))
      await sendCommand(tlsSocket, Buffer.from(password).toString('base64'))

      // Send test email
      await sendCommand(tlsSocket, `MAIL FROM:<${FROM}>`)
      await sendCommand(tlsSocket, `RCPT TO:<${TO}>`)
      await sendCommand(tlsSocket, 'DATA')
      tlsSocket.write('From: GFIN Test <' + FROM + '>\r\n')
      tlsSocket.write('To: ' + TO + '\r\n')
      tlsSocket.write('Subject: Teste SMTP GFIN\r\n')
      tlsSocket.write('Content-Type: text/plain\r\n')
      tlsSocket.write('\r\n')
      tlsSocket.write('Este é um email de teste do sistema GFIN.\r\n')
      tlsSocket.write('Se você está vendo isso, o SMTP funciona!\r\n')
      await sendCommand(tlsSocket, '.')

      console.log('\n✅ Email enviado com sucesso!\n')
      await sendCommand(tlsSocket, 'QUIT')
      tlsSocket.end()
    })

    tlsSocket.on('error', (err) => {
      console.error('Erro TLS:', err.message)
    })
  })

  socket.on('error', (err) => {
    console.error('Erro conexão:', err.message)
  })
}

test()
