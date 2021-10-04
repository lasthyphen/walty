// Doesn't really matter what we set, it will change
import axios, { AxiosInstance } from 'axios'

const wallet_api: AxiosInstance = axios.create({
    baseURL: '/api',
    withCredentials: false,
})
export { wallet_api }
