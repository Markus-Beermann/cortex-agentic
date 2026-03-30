import type {
  ProviderRequest,
  ProviderResponse
} from "../../core/contracts";

export interface ProviderPort {
  readonly id: string;
  readonly version: "v1";
  execute(request: ProviderRequest): Promise<ProviderResponse>;
}
