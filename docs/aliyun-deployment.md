# GIM服务阿里云Kubernetes集群部署指南

## 概述

本文档详细说明如何将GIM即时通讯服务部署到阿里云Kubernetes集群中。

## 前置条件

### 1. 阿里云资源准备

- **Kubernetes集群**: 已创建并运行的阿里云ACK集群
- **容器镜像服务**: 已开通阿里云容器镜像服务（ACR）
- **存储服务**: 集群已安装CSI存储插件
- **网络配置**: 确保集群网络配置正确

### 2. 本地环境准备

```bash
# 安装必要工具
- kubectl (已配置连接到阿里云集群)
- helm (版本 >= 3.0)
- docker (用于构建镜像)
```

### 3. 权限配置

```bash
# 配置kubectl连接到阿里云集群
kubectl config use-context your-aliyun-cluster-context

# 验证连接
kubectl cluster-info
kubectl get nodes
```

## 部署配置分析

### StorageClass检查结果

经过检查，您的阿里云集群中存在以下StorageClass：

1. **im-server**: 使用阿里云NAS存储（共享文件系统）
   - 适用于：共享文件存储
   - 不适用于：数据库存储（MySQL/Redis）

2. **gim-database-storage**: 使用阿里云ESSD云盘（推荐）
   - 适用于：高性能数据库存储
   - 特点：高IOPS、低延迟

### 配置调整

基于分析，我们做了以下调整：

1. **删除了静态PV配置文件**：
   - `mysql/persistent-volume.yaml`
   - `redis/persistent-volume.yaml`
   
2. **修改StorageClass配置**：
   - MySQL和Redis使用 `gim-database-storage`
   - 支持动态PVC创建

3. **创建阿里云专用配置**：
   - `values-aliyun.yaml`: 阿里云环境优化配置
   - 包含资源限制、副本数量等

## 部署步骤

### 1. 配置镜像仓库

```bash
# 登录阿里云镜像仓库
docker login registry.cn-shenzhen.aliyuncs.com

# 修改部署脚本中的镜像仓库地址
vim deploy_aliyun.sh
# 将 REGISTRY 变量修改为你的镜像仓库地址
```

### 2. 执行部署

```bash
# 给部署脚本执行权限
chmod +x deploy_aliyun.sh

# 执行部署
./deploy_aliyun.sh
```

### 3. 验证部署

```bash
# 查看所有资源
kubectl get all -n gim

# 查看PVC状态
kubectl get pvc -n gim

# 查看Pod日志
kubectl logs -f deployment/connect-deployment -n gim
```

## 配置文件说明

### values-aliyun.yaml 主要配置

```yaml
# 存储配置
storageClass: gim-database-storage  # 高性能ESSD云盘
mysqlStorage: 50Gi                    # MySQL存储大小
redisStorage: 50Gi                    # Redis存储大小

# 服务副本配置
server:
  connect:
    replicas: 2  # 连接服务2个副本
  logic:
    replicas: 2  # 逻辑服务2个副本
  user:
    replicas: 2  # 用户服务2个副本
  file:
    replicas: 1  # 文件服务1个副本

# 资源限制
resources:
  mysql:
    requests: { memory: "1Gi", cpu: "500m" }
    limits: { memory: "2Gi", cpu: "1000m" }
```

## 网络访问配置

### 内部服务访问

服务间通过Kubernetes Service进行通信：

- `mysql:3306` - MySQL数据库
- `redis:6379` - Redis缓存
- `connect:8000,8001,8002` - 连接服务
- `logic:8000` - 逻辑服务
- `user:8000` - 用户服务
- `file:8000` - 文件服务

### 外部访问配置

如需外部访问，可以配置LoadBalancer或Ingress：

```yaml
# LoadBalancer示例
apiVersion: v1
kind: Service
metadata:
  name: gim-external
  annotations:
    service.beta.kubernetes.io/alicloud-loadbalancer-spec: "slb.s1.small"
spec:
  type: LoadBalancer
  ports:
    - port: 8001
      targetPort: 8001
      name: tcp
    - port: 8002
      targetPort: 8002
      name: websocket
  selector:
    app: connect
```

## 监控和日志

### 查看服务状态

```bash
# 查看Pod状态
kubectl get pods -n gim -w

# 查看服务状态
kubectl get svc -n gim

# 查看存储状态
kubectl get pvc -n gim
```

### 查看日志

```bash
# 查看特定服务日志
kubectl logs -f deployment/connect-deployment -n gim
kubectl logs -f deployment/logic-deployment -n gim
kubectl logs -f deployment/user-deployment -n gim
kubectl logs -f deployment/file-deployment -n gim

# 查看数据库日志
kubectl logs -f statefulset/mysql-stateful-set -n gim
kubectl logs -f statefulset/redis-stateful-set -n gim
```

## 故障排除

### 常见问题

1. **Pod无法启动**
   ```bash
   kubectl describe pod <pod-name> -n gim
   ```

2. **PVC无法绑定**
   ```bash
   kubectl describe pvc <pvc-name> -n gim
   # 检查StorageClass是否存在
   kubectl get storageclass
   ```

3. **镜像拉取失败**
   ```bash
   # 检查镜像仓库配置
   kubectl get secret -n gim
   # 检查镜像地址是否正确
   kubectl describe pod <pod-name> -n gim
   ```

4. **服务无法访问**
   ```bash
   # 检查Service配置
   kubectl get svc -n gim
   # 检查端口转发
   kubectl port-forward svc/connect 8001:8001 -n gim
   ```

### 性能优化

1. **存储性能**：
   - 使用ESSD云盘获得更好的IOPS性能
   - 根据实际需求调整存储大小

2. **计算资源**：
   - 根据负载调整CPU和内存限制
   - 使用HPA进行自动扩缩容

3. **网络优化**：
   - 配置适当的负载均衡器规格
   - 使用Ingress进行七层负载均衡

## 升级和维护

### 应用升级

```bash
# 更新镜像版本
helm upgrade gim ./deploy/k8s \
    -f values-aliyun.yaml \
    --namespace gim \
    --set server.connect.image=registry.cn-shenzhen.aliyuncs.com/your-namespace/connect:v1.1.0
```

### 数据备份

```bash
# 备份MySQL数据
kubectl exec -it mysql-stateful-set-0 -n gim -- mysqldump -u root -p123456 --all-databases > backup.sql

# 备份Redis数据
kubectl exec -it redis-stateful-set-0 -n gim -- redis-cli BGSAVE
```

### 卸载应用

```bash
# 卸载Helm应用
helm uninstall gim -n gim

# 删除PVC（注意：这会删除数据）
kubectl delete pvc --all -n gim

# 删除命名空间
kubectl delete namespace gim
```

## 总结

通过以上配置，GIM服务已经适配阿里云Kubernetes环境：

1. ✅ 使用阿里云ESSD云盘作为数据库存储
2. ✅ 删除了不必要的静态PV配置
3. ✅ 配置了适合生产环境的资源限制
4. ✅ 提供了完整的部署脚本和文档
5. ✅ 支持动态PVC创建和管理

现在可以安全地将服务部署到阿里云集群中。