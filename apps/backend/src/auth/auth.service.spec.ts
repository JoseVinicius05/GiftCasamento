import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

// Mocks manuais do Prisma e do JwtService — não precisa de banco nem de Nest
// Testing Module de verdade pra testar as regras do AuthService.
describe('AuthService', () => {
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };
  let authService: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('fake-jwt-token'),
    };
    authService = new AuthService(prisma as any, jwtService as any);
  });

  describe('register', () => {
    it('lança ConflictException se o e-mail já estiver cadastrado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'ja@existe.com' });

      await expect(
        authService.register({ name: 'Caio', email: 'ja@existe.com', password: 'senha12345' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('nunca salva a senha em texto puro no banco', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: '1', name: data.name, email: data.email, createdAt: new Date() }),
      );

      await authService.register({ name: 'Caio', email: 'novo@teste.com', password: 'senha12345' });

      const savedData = prisma.user.create.mock.calls[0][0].data;
      expect(savedData.passwordHash).not.toBe('senha12345');
      await expect(bcrypt.compare('senha12345', savedData.passwordHash)).resolves.toBe(true);
    });
  });

  describe('login', () => {
    it('lança UnauthorizedException quando a senha está errada', async () => {
      const passwordHash = await bcrypt.hash('senhacerta', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        name: 'Caio',
        email: 'caio@teste.com',
        passwordHash,
      });

      await expect(
        authService.login({ email: 'caio@teste.com', password: 'senhaerrada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException (não algo diferente) quando o e-mail não existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nao-existe@teste.com', password: 'qualquer' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('retorna accessToken e os dados do usuário com credenciais corretas', async () => {
      const passwordHash = await bcrypt.hash('senhacerta', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        name: 'Caio',
        email: 'caio@teste.com',
        passwordHash,
      });

      const result = await authService.login({ email: 'caio@teste.com', password: 'senhacerta' });

      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.user).toEqual({ id: '1', name: 'Caio', email: 'caio@teste.com' });
    });
  });
});
