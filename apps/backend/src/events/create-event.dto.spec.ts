import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEventDto } from './dto/create-event.dto';

describe('CreateEventDto — validação de data', () => {
  function makeDto(eventDate: string) {
    return plainToInstance(CreateEventDto, {
      title: 'Casamento Teste',
      eventType: 'casamento',
      eventDate,
      guestPassword: '1234',
      pixKey: 'chave@example.com',
    });
  }

  it('rejeita uma data no passado', async () => {
    const errors = await validate(makeDto('2020-01-01'));
    const dateError = errors.find((e) => e.property === 'eventDate');

    expect(dateError).toBeDefined();
    expect(Object.values(dateError?.constraints ?? {})).toContain(
      'A data do evento não pode ser no passado',
    );
  });

  it('aceita a data de hoje', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const errors = await validate(makeDto(today));

    expect(errors.find((e) => e.property === 'eventDate')).toBeUndefined();
  });

  it('aceita uma data futura', async () => {
    const errors = await validate(makeDto('2099-12-31'));

    expect(errors.find((e) => e.property === 'eventDate')).toBeUndefined();
  });
});
