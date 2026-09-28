import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

// Hash "de mentira" usado quando o e-mail não existe, só pra gastar o mesmo
// tempo de CPU que um bcrypt.compare real gastaria — evita que alguém descubra
// se um e-mail está cadastrado medindo o tempo de resposta do login.
const DUMMY_HASH = '$2a$10$C6UzMDM.H6dfI/f/IKcEeO7ekcWyfx8ZBnu3RmZu8ByLW5RJqzXLu';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }

    // Nunca salvar a senha em texto puro: só o hash vai pro banco.
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: { id: true, name: true, email: true, createdAt: true }, // sem passwordHash
      });
      return user;
    } catch (error) {
      // Duas requisições simultâneas com o mesmo e-mail: o índice único do banco pega a segunda.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Este e-mail já está cadastrado');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Roda o compare mesmo se o usuário não existir (contra o hash "de mentira"),
    // pra não vazar por timing se o e-mail está cadastrado ou não.
    const isPasswordValid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
