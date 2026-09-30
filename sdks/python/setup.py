from setuptools import setup, find_packages

setup(
    name="pabandi-sdk",
    version="0.1.0",
    description="Pabandi Trust API SDK for Python",
    author="Pabandi",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=["requests>=2.28"],
)
