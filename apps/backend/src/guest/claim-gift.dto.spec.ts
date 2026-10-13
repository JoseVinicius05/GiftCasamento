import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClaimGiftDto } from './dto/claim-gift.dto';

describe('ClaimGiftDto', () => {
  async function errorsFor(body: Record<string, unknown>) {
    return validate(plainToInstance(ClaimGiftDto, body));
  }

  it("aceita 'pix' e 'link'", async () => {
    expect(await errorsFor({ method: 'pix' })).toHaveLength(0);
    expect(await errorsFor({ method: 'link' })).toHaveLength(0);
  });

  it('rejeita outro valor, vazio e ausente', async () => {
    expect(await errorsFor({ method: 'cartao' })).not.toHaveLength(0);
    expect(await errorsFor({ method: '' })).not.toHaveLength(0);
    expect(await errorsFor({})).not.toHaveLength(0);
  });
});
