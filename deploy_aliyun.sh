#!/usr/bin/env bash

# 阿里云Kubernetes集群部署脚本
# 使用说明：
# 1. 确保已配置kubectl连接到阿里云集群
# 2. 确保已登录阿里云镜像仓库
# 3. 修改REGISTRY变量为你的阿里云镜像仓库地址

set -e

# 配置变量
REGISTRY="registry.cn-shenzhen.aliyuncs.com/angrymiao"
VERSION="1.0.7"
NAMESPACE="gim"

echo "=== 开始部署GIM到阿里云Kubernetes集群 ==="

# 检查kubectl连接
echo "检查kubectl连接..."
kubectl cluster-info


# 构建和推送镜像
echo "=== 构建和推送镜像 ==="

# 构建connect服务镜像
echo "构建connect服务镜像..."
./build.sh connect $VERSION
docker tag connect:$VERSION $REGISTRY/connect:$VERSION
docker push $REGISTRY/connect:$VERSION

# 构建logic服务镜像
echo "构建logic服务镜像..."
./build.sh logic $VERSION
docker tag logic:$VERSION $REGISTRY/logic:$VERSION
docker push $REGISTRY/logic:$VERSION

# 构建business服务镜像
echo "构建business服务镜像..."
./build.sh business $VERSION
docker tag business:$VERSION $REGISTRY/business:$VERSION
docker push $REGISTRY/business:$VERSION

# 构建file服务镜像
echo "构建file服务镜像..."
./build.sh file $VERSION
docker tag file:$VERSION $REGISTRY/file:$VERSION
docker push $REGISTRY/file:$VERSION

echo "=== 镜像构建和推送完成 ==="

# 更新values文件中的镜像地址
echo "更新镜像配置..."
sed -i "s|image: connect:.*|image: $REGISTRY/connect:$VERSION|g" deploy/k8s/values-aliyun.yaml
sed -i "s|image: logic:.*|image: $REGISTRY/logic:$VERSION|g" deploy/k8s/values-aliyun.yaml
sed -i "s|image: business:.*|image: $REGISTRY/business:$VERSION|g" deploy/k8s/values-aliyun.yaml
sed -i "s|image: file:.*|image: $REGISTRY/file:$VERSION|g" deploy/k8s/values-aliyun.yaml

# 部署到Kubernetes
echo "=== 开始Helm部署 ==="
cd deploy/k8s

# 检查StorageClass是否存在
echo "检查StorageClass..."
kubectl get storageclass gim-database-storage || {
    echo "错误: StorageClass 'gim-database-storage' 不存在"
    echo "请检查阿里云CSI插件是否正确安装"
    exit 1
}

# 使用阿里云配置文件部署
helm upgrade --install gim . \
    -f values-aliyun.yaml \
    --namespace $NAMESPACE \
    --create-namespace \
    --wait \
    --timeout 10m

echo "=== 部署完成 ==="

# 检查部署状态
echo "检查部署状态..."
kubectl get pods -n $NAMESPACE
kubectl get svc -n $NAMESPACE
kubectl get pvc -n $NAMESPACE

echo "=== GIM服务已成功部署到阿里云Kubernetes集群 ==="
echo "命名空间: $NAMESPACE"
echo "可以使用以下命令查看服务状态:"
echo "kubectl get all -n $NAMESPACE"
echo "kubectl logs -f deployment/connect-deployment -n $NAMESPACE"