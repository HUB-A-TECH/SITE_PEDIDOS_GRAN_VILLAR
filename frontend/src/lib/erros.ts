import axios from 'axios';

/** Mensagem que o servidor mandou (em português) ou, se não houver, o texto padrão. */
export const mensagemErro = (e: unknown, padrao: string) =>
  axios.isAxiosError(e) && e.response?.data?.mensagem ? e.response.data.mensagem : padrao;
