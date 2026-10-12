import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyGuestAccessDto } from './dto/verify-guest-access.dto';

describe('VerifyGuestAccessDto', () => {
  async function check(body: Record<string, unknown>) {
    const dto = plainToInstance(VerifyGuestAccessDto, body);
    const errors = await validate(dto);
    return { dto, errors, failed: (property: string) => errors.some((e) => e.property === property) };
  }

  it('aceita senha e nome válidos', async () => {
    const { errors } = await check({ password: 'convidados123', name: 'Maria Souza' });

    expect(errors).toHaveLength(0);
  });

  it('apara espaços do nome e junta espaços repetidos', async () => {
    const { dto, errors } = await check({ password: '1234', name: '  Maria    Souza  ' });

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Maria Souza');
  });

  it('rejeita nome ausente, em branco ou de uma letra só', async () => {
    expect((await check({ password: '1234' })).failed('name')).toBe(true);
    expect((await check({ password: '1234', name: '   ' })).failed('name')).toBe(true);
    expect((await check({ password: '1234', name: 'M' })).failed('name')).toBe(true);
  });

  it('rejeita nome com mais de 60 caracteres', async () => {
    expect((await check({ password: '1234', name: 'a'.repeat(61) })).failed('name')).toBe(true);
  });

  it('rejeita senha vazia ou ausente', async () => {
    expect((await check({ name: 'Maria' })).failed('password')).toBe(true);
    expect((await check({ password: '', name: 'Maria' })).failed('password')).toBe(true);
  });
});
