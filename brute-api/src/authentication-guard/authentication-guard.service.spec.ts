import { Test, TestingModule } from "@nestjs/testing";
import { CredentialsGuardService } from "./credentials-guard.service";

describe("CredentialsGuardService", () => {
  let service: CredentialsGuardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CredentialsGuardService],
    }).compile();

    service = module.get<CredentialsGuardService>(CredentialsGuardService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
