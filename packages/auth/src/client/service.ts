import Axios from 'axios'
import { JWK } from 'jose'

import { BaseService } from '../shared/baseService'
import { IAppConfig } from '../config/app'

export interface JWKWithRequired extends JWK {
  kid: string
  x: string
  alg: string
  kty: string
  crv: string
  exp?: number
  nbf?: number
  revoked?: boolean
}

export interface ClientKey {
  jwk: JWKWithRequired
  client: ClientDetails
}

interface DisplayInfo {
  name: string
  uri: string
}

export interface KeyInfo {
  proof: string
  jwk: JWKWithRequired
}

export interface ClientInfo {
  display: DisplayInfo
  key: KeyInfo
}

interface ClientDetails {
  id: string
  name: string
  image: string
  uri: string
  email: string
}

interface ServiceDependencies extends BaseService {
  config: IAppConfig
}

export interface ClientService {
  validateClient(clientInfo: ClientInfo): Promise<boolean>
  getKeyByKid(kid: string): Promise<ClientKey>
}

export async function createClientService({
  logger,
  config
}: ServiceDependencies): Promise<ClientService> {
  const log = logger.child({
    service: 'ClientService'
  })

  const deps: ServiceDependencies = {
    logger: log,
    config
  }

  return {
    validateClient: (clientInfo: ClientInfo) =>
      validateClient(deps, clientInfo),
    getKeyByKid: (kid: string) => getKeyByKid(deps, kid)
  }
}

async function validateClient(
  deps: ServiceDependencies,
  clientInfo: ClientInfo
): Promise<boolean> {
  if (!isClientInfo(clientInfo)) return false

  const { jwk } = clientInfo.key

  const clientKey = await getKeyByKid(deps, jwk.kid)

  if (
    !clientKey ||
    !isJWKWithRequired(clientKey.jwk) ||
    jwk.x !== clientKey.jwk.x ||
    clientKey.jwk.revoked
  )
    return false

  if (
    clientInfo.display.name !== clientKey.client.name ||
    clientInfo.display.uri !== clientKey.client.uri
  )
    return false

  const currentDate = new Date()
  if (clientKey.jwk.exp && currentDate >= new Date(clientKey.jwk.exp * 1000))
    return false
  if (clientKey.jwk.nbf && currentDate < new Date(clientKey.jwk.nbf * 1000))
    return false

  return true
}

async function getKeyByKid(
  deps: ServiceDependencies,
  kid: string
): Promise<ClientKey> {
  return Axios.get(kid)
    .then((res) => res.data)
    .catch((err) => {
      deps.logger.error(
        {
          err,
          kid: kid
        },
        'failed to fetch client info'
      )
      return false
    })
}

function isJWKWithRequired(
  jwkWithRequired: unknown
): jwkWithRequired is JWKWithRequired {
  const jwk = jwkWithRequired as JWKWithRequired
  return !(
    jwk.kty !== 'OKP' ||
    (jwk.use && jwk.use !== 'sig') ||
    (jwk.key_ops &&
      (!jwk.key_ops.includes('sign') || !jwk.key_ops.includes('verify'))) ||
    jwk.alg !== 'EdDSA' ||
    jwk.crv !== 'Ed25519'
  )
}

function isDisplayInfo(display: unknown): display is DisplayInfo {
  return (
    (display as DisplayInfo).name !== undefined &&
    (display as DisplayInfo).uri !== undefined
  )
}

function isKeyInfo(key: unknown): key is KeyInfo {
  return (
    (key as KeyInfo).proof !== undefined &&
    isJWKWithRequired((key as KeyInfo).jwk)
  )
}

function isClientInfo(client: unknown): client is ClientInfo {
  return (
    isDisplayInfo((client as ClientInfo).display) &&
    isKeyInfo((client as ClientInfo).key)
  )
}
