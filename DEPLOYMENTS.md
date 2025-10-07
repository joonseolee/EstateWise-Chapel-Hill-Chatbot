# EstateWise Deployment Reference

<p align="center">
  <img src="https://img.shields.io/badge/AWS-ECS%20Fargate-FF9900?logo=amazonaws&logoColor=white" alt="AWS"/>
  <img src="https://img.shields.io/badge/Azure-Container%20Apps-0078D4?logo=microsoftazure&logoColor=white" alt="Azure"/>
  <img src="https://img.shields.io/badge/GCP-Cloud%20Run-4285F4?logo=googlecloud&logoColor=white" alt="GCP"/>
  <img src="https://img.shields.io/badge/HashiCorp-Terraform,%20Consul,%20Nomad-844FBA?logo=hashicorp&logoColor=white" alt="HashiCorp"/>
  <img src="https://img.shields.io/badge/Kubernetes-1.29-326CE5?logo=kubernetes&logoColor=white" alt="Kubernetes"/>
  <img src="https://img.shields.io/badge/Vercel-Frontend%20%26%20Edge-000000?logo=vercel&logoColor=white" alt="Vercel"/>
  <img src="https://img.shields.io/badge/Jenkins-Multi--cloud%20CI/CD-D24939?logo=jenkins&logoColor=white" alt="Jenkins"/>
</p>

EstateWise ships with four production-grade deployment tracks so you can choose the cloud that best fits your stack:

1. **AWS** – ECS on Fargate behind an ALB with CodePipeline / CodeBuild CI/CD.
2. **Azure** – Azure Container Apps + Key Vault, driven by Bicep modules and Azure DevOps.
3. **Google Cloud** – Cloud Run with Cloud Build, Artifact Registry, and VPC Access.
4. **HashiCorp Platform** – Terraform-orchestrated Kubernetes (EKS/AKS/GKE or self-managed) with Consul service mesh and Nomad batch runners.

In addition, the monorepo already supports **Vercel** deployments for the frontend (and optional backend edge functions) for teams that prefer Vercel’s serverless workflow.

> ℹ️  Mixed deployments are fully supported: for example run the backend on AWS while exposing the frontend on Vercel, or use the HashiCorp stack for internal tooling while shipping the public experience via Cloud Run.

---

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [AWS Deployment](#aws-deployment)
- [Azure Deployment](#azure-deployment)
- [Google Cloud Deployment](#google-cloud-deployment)
- [HashiCorp + Kubernetes Stack](#hashicorp--kubernetes-stack)
- [Agentic AI Orchestrator](#agentic-ai-orchestrator)
- [MCP Server](#mcp-server)
- [Vercel Frontend/Backend](#vercel-frontendbackend)
- [CI/CD Integration](#cicd-integration)
- [Choosing the Right Path](#choosing-the-right-path)
- [Reference Commands](#reference-commands)

---

## High-Level Architecture

```mermaid
flowchart LR
  subgraph Repo
    G[GitHub / GitLab]
    J[Jenkins]
    CP[CI Scripts]
  end

  subgraph CloudTargets
    direction TB
    AWS[(AWS ECS Fargate)]
    AZ[(Azure Container Apps)]
    GCP[(GCP Cloud Run)]
    HC[(Kubernetes + Consul + Nomad)]
    VC[(Vercel Frontend)]
  end

  G --> J
  J -->|Pipeline stages| CP
  CP -->|deploy.sh| AWS
  CP -->|az containerapp update| AZ
  CP -->|gcloud run deploy| GCP
  CP -->|terraform apply| HC
  CP -->|vercel deploy| VC

  AWS -.->|ALB| Users
  AZ -.->|ACA Ingress| Users
  GCP -.->|HTTPS| Users
  HC -.->|Ingress Controller| Users
  VC -.->|Edge CDN| Users
```

Each target shares the same containers and environment variables – only the infrastructure wrapper changes.

---

## AWS Deployment

Path: [`aws/`](aws/README.md)

**Stack highlights**
- `cloudformation/vpc.yaml`: opinionated VPC (public/private subnets, NAT, optional flow logs).
- `cloudformation/ecs-service.yaml`: Fargate service with Secrets Manager wiring, CloudWatch logs, autoscaling.
- `codepipeline.yaml`: secure S3 artifact store, CodeBuild image pipeline, ECS blue/green deploy.
- `deploy.sh`: end-to-end helper that also provisions DocumentDB.

**Quick start**
```bash
cd aws
make deploy-vpc
dgn=$(aws cloudformation describe-stacks --stack-name estatewise-vpc --query 'Stacks[0].Outputs')
make deploy-iam
make deploy-alb VpcId=<vpc-id> PublicSubnetIds=<subnet-a,subnet-b>
make deploy-ecs-cluster
make deploy-ecs-service \
  CLUSTER_NAME=estatewise-ecs-cluster \
  EXECUTION_ROLE_ARN=<role-arn> \
  CONTAINER_IMAGE=<account>.dkr.ecr.us-east-1.amazonaws.com/estatewise-backend:latest \
  SUBNET_IDS=<private-a,private-b> \
  SECURITY_GROUP_IDS=<sg-id> \
  TARGET_GROUP_ARN=<tg-arn> \
  MONGO_SECRET_ARN=<secret-arn> \
  JWT_SECRET_ARN=<secret-arn> \
  GOOGLE_SECRET_ARN=<secret-arn> \
  PINECONE_SECRET_ARN=<secret-arn>
```

**Mermaid – AWS flow**
```mermaid
sequenceDiagram
  participant Dev as Developer
  participant CP as CodePipeline
  participant CB as CodeBuild
  participant ECR
  participant ECS
  participant ALB

  Dev->>CP: push to main
  CP->>CB: trigger build
  CB->>ECR: docker build/push
  CB->>CP: imagedefinitions.json
  CP->>ECS: update service
  ECS->>ALB: register tasks
  ALB->>Users: serve HTTPS traffic
```

---

## Azure Deployment

Path: [`azure/`](azure/README.md)

**Stack highlights**
- Modular Bicep: network, Log Analytics/App Insights, data tier (ACR + Cosmos + Storage), Key Vault, Container Apps environment.
- `azure/deploy.sh`: orchestrates Bicep deployment, builds/pushes to ACR, updates Container App revision.
- Azure DevOps pipeline (`azure/azure-pipelines.yml`) for automated builds.

**Quick start**
```bash
az login
./azure/deploy.sh \
  --resource-group estatewise-rg \
  --location eastus \
  --env estatewise \
  --image-tag $(git rev-parse --short HEAD) \
  --jwt-secret <jwt> \
  --google-ai-api-key <gemini> \
  --pinecone-api-key <pinecone>
```

**Mermaid – Azure flow**
```mermaid
graph TD
  subgraph Provisioning
    Bicep[[infra/main.bicep]] --> ACR((ACR))
    Bicep --> CAEnv[(Container Apps Env)]
    Bicep --> KV[(Key Vault)]
  end
  DockerImage -->|az acr build| ACR
  ACR -->|az containerapp update| ContainerApp
  KV --> ContainerApp
  ContainerApp -->|HTTPs| Users
```

---

## Google Cloud Deployment

Path: [`gcp/`](gcp/README.md)

**Stack highlights**
- Deployment Manager configs for VPC + NAT + Serverless VPC connector, Cloud Run service, service account roles, storage bucket.
- `cloudbuild.yaml` pipeline: npm ci + tests → docker build/push → Cloud Run deploy using secrets.
- `gcp/deploy.sh`: optional helper to run Deployment Manager + Cloud Build from a workstation or CI node.

**Quick start**
```bash
./gcp/deploy.sh \
  --project <PROJECT_ID> \
  --region us-east1 \
  --service-account estatewise-run@<PROJECT_ID>.iam.gserviceaccount.com
```

**Mermaid – GCP flow**
```mermaid
sequenceDiagram
  participant Dev as Developer
  participant CB as Cloud Build
  participant AR as Artifact Registry
  participant CR as Cloud Run
  participant Secret as Secret Manager

  Dev->>CB: gcloud builds submit
  CB->>AR: build & push image
  CB->>CR: gcloud run deploy
  Secret-->>CR: Inject env secrets
  CR->>Users: HTTPS request handling
```

---

## HashiCorp + Kubernetes Stack

Path: [`hashicorp/`](hashicorp/README.md) and [`kubernetes/`](kubernetes/README.md)

**Stack highlights**
- Terraform modules that install Consul and Nomad via Helm charts on any Kubernetes cluster (EKS, AKS, GKE, or self-managed).
- Consul provides service discovery / mesh; Nomad runs scheduled jobs (market ingest, analytics pipelines).
- Kubernetes manifests (`kubernetes/estates/`) deploy backend + frontend workloads with optional Consul sidecars.
- `hashicorp/deploy.sh` automates `terraform init/plan/apply`, wiring kubeconfig + Helm providers.

**Quick start**
```bash
cd hashicorp
./deploy.sh \
  --kubeconfig ~/.kube/config \
  --context estatewise-eks \
  --do-apply
kubectl apply -f ../kubernetes/estates/backend.yaml
kubectl apply -f ../kubernetes/estates/frontend.yaml
```

**Mermaid – HashiCorp flow**
```mermaid
graph TD
  TF[TERRAFORM] -->|providers helm+kubernetes| Consul[(Consul Service Mesh)]
  TF --> Nomad[(Nomad Batch Cluster)]
  TF --> K8s[(Kubernetes)]
  Consul -->|sidecar| Backend
  Nomad -->|scheduled jobs| Pipelines
  K8s --> Ingress[NGINX/ALB Ingress]
  Ingress --> Users
```

---

## Agentic AI Orchestrator

- **Container Image** – See `agentic-ai/Dockerfile`; build with `docker build -f agentic-ai/Dockerfile .` and push to your registry.
- **Docker Compose** – `agentic-ai/docker-compose.yaml` starts the orchestrator with all dependencies (LLM/Pinecone/Neo4j) supplied via `.env`.
- **Kubernetes** – Apply `agentic-ai/k8s/` manifests (ConfigMap, Secret, Deployment) to run the CLI in a cluster with tty/stdin enabled.
- **Cloud providers** – Fargate template (`agentic-ai/aws/ecs-service.yaml`), Azure Container Apps Bicep (`agentic-ai/azure/containerapp.bicep`), and Cloud Run config (`agentic-ai/gcp/cloudrun.yaml`).

Full instructions live in [agentic-ai/DEPLOYMENT.md](agentic-ai/DEPLOYMENT.md).

---

## MCP Server

- **Container Image** – `mcp/Dockerfile` packages the MCP stdio server for sidecar usage; build/push to `ghcr.io/your-org/estatewise-mcp`.
- **Docker Compose** – `mcp/docker-compose.yaml` runs the server with caches tuned via env vars.
- **Kubernetes Sidecar** – `mcp/k8s/sidecar-example.yaml` demonstrates pairing the MCP container with the Agentic AI deployment in the same pod.
- **Cloud providers** – Fargate template (`mcp/aws/ecs-service.yaml`), Azure Container Apps Bicep (`mcp/azure/containerapp.bicep`), and Cloud Run config (`mcp/gcp/cloudrun.yaml`).

Refer to [mcp/DEPLOYMENT.md](mcp/DEPLOYMENT.md) for operational guidance.

---

## Vercel Frontend/Backend

The frontend (`frontend/`) ships with a `vercel.json` and can be deployed directly via `vercel deploy` or the Jenkins stage. The backend can run as an Edge Function or proxy to the primary API.

- Configure project once (`vercel link`).
- Set required env vars (`vercel env add ...`).
- Jenkins stage `Vercel Deploy` prints the production URL and commit metadata.

---

## CI/CD Integration

### Jenkins

`jenkins/workflow.Jenkinsfile` now supports multi-target deployments via environment toggles:

| Env Var | Effect |
|---------|--------|
| `DEPLOY_AWS=1` | Runs `aws/deploy.sh` with provided parameter bundle. |
| `DEPLOY_AZURE=1` | Invokes `azure/deploy.sh`. |
| `DEPLOY_GCP=1` | Executes `gcp/deploy.sh`. |
| `DEPLOY_HASHICORP=1` | Runs Terraform (`hashicorp/deploy.sh`). |
| `DEPLOY_K8S_MANIFESTS=1` | Applies manifests under `kubernetes/`. |

Secrets / parameters are passed as Base64 payloads (`*_B64`) to avoid accidental logging. Example configuration is documented in `jenkins/README.md`.

### Other CI

- **GitHub Actions** – reuse `aws/codepipeline.yaml`, `azure/azure-pipelines.yml`, or `gcp/cloudbuild.yaml` directly.
- **Azure DevOps** – use the included pipeline for Container Apps.
- **GitLab CI** – call the same scripts (`aws/deploy.sh`, `hashicorp/deploy.sh`) in custom jobs.

---

## Choosing the Right Path

| Requirement | Recommended Target |
|-------------|--------------------|
| Fully managed container runtime, minimal ops | GCP Cloud Run or Azure Container Apps |
| Deep AWS ecosystem integration | AWS ECS Fargate stack |
| Hybrid cloud / service mesh / batch jobs | HashiCorp Terraform + Consul + Nomad |
| Static-first UI with edge caching | Vercel |
| Need Kubernetes primitives (HPA, custom CRDs) | HashiCorp + Kubernetes stack |

---

## Reference Commands

```bash
# Validate CloudFormation
make -C aws validate

# Terraform plan for HashiCorp stack
cd hashicorp/terraform
terraform init
terraform plan -var='kubeconfig_path=~/.kube/config' -var='context=estatewise'

# Azure DevOps pipeline run
az pipelines run --name estatewise-container-apps --variables IMAGE_TAG=$(git rev-parse --short HEAD)

# Trigger Cloud Build manually
gcloud builds submit --config gcp/cloudbuild.yaml --substitutions=_REGION=us-east1

# Build Agentic AI container image
docker build -f agentic-ai/Dockerfile -t ghcr.io/your-org/estatewise-agentic:latest .

# Build MCP server image
docker build -t ghcr.io/your-org/estatewise-mcp:latest mcp/

# Apply Kubernetes overlays
kubectl apply -k kubernetes/overlays/prod
```

For deeper dives, follow the platform-specific READMEs inside each directory.

- [AWS Deployment](aws/README.md)
- [Azure Deployment](azure/README.md)
- [Google Cloud Deployment](gcp/README.md)
- [HashiCorp + Kubernetes Stack](hashicorp/README.md) and [Kubernetes Manifests](kubernetes/README.md)
- [Agentic AI Orchestrator](agentic-ai/README.md)
- [MCP Server](mcp/README.md)
- [Jenkins CI/CD](jenkins/README.md)
